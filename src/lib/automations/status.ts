/**
 * Estado de las automatizaciones (jobs de pg_cron que llaman a
 * public.run_http_cron_job y dejan registro en public.job_runs).
 *
 * Módulo puro: sin red ni base de datos, para que el servidor y
 * scripts/check-automations.mjs usen exactamente la misma lógica.
 *
 *   job_name ──groupForJob──▶ grupo (Alertas, Reporte mensual, …)
 *   última ejecución + conteos 7 días ──deriveGroupStatus──▶ OK / Con errores / Atrasada / Sin ejecutar
 *   grupos ──overallStatus──▶ insignia general
 */

export type GroupId =
  | "campaign_alerts"
  | "monthly_reports"
  | "billing"
  | "meta_ingest"
  | "google_ads_ingest"
  | "onboarding_cleanup"
  | "whatsapp_dispatch"
  | "other";

/** Con qué frecuencia se espera que corra el grupo (define cuándo está "atrasado"). */
export type Cadence = "daily" | "monthly" | "on_demand";

export interface GroupDef {
  readonly id: GroupId;
  readonly label: string;
  readonly description: string;
  readonly cadence: Cadence;
  /** El job pertenece al grupo si su nombre es exacto o empieza con `${prefix}_`. */
  readonly prefixes: readonly string[];
}

export const AUTOMATION_GROUPS: readonly GroupDef[] = [
  {
    id: "campaign_alerts",
    label: "Alertas de campañas",
    description:
      "Cada mañana revisa las campañas de Meta y Google de cada cliente y crea alertas: gasto sin resultados, costo por resultado al alza, campañas detenidas o conexión caída.",
    cadence: "daily",
    prefixes: ["campaign_alerts"],
  },
  {
    id: "monthly_reports",
    label: "Reporte mensual",
    description:
      "El día 1 de cada mes genera el reporte de resultados del mes anterior para cada cliente activo. No pisa reportes ya enviados.",
    cadence: "monthly",
    prefixes: ["monthly_reports"],
  },
  {
    id: "billing",
    label: "Cobro mensual",
    description:
      "Una vez al día crea los cobros recurrentes de los clientes cuyo día de cobro es hoy, con su link de pago.",
    cadence: "daily",
    prefixes: ["billing_monthly_charges"],
  },
  {
    id: "meta_ingest",
    label: "Ingesta Meta",
    description:
      "Cada madrugada descarga los resultados de Meta (anuncios e Instagram) de las cuentas conectadas. Las alertas y reportes dependen de estos datos.",
    cadence: "daily",
    prefixes: ["meta_insights_daily"],
  },
  {
    id: "google_ads_ingest",
    label: "Ingesta Google Ads",
    description:
      "Cada madrugada descarga los últimos 3 días de Google Ads de las cuentas conectadas, por lotes.",
    cadence: "daily",
    prefixes: ["google_ads_ingest"],
  },
  {
    id: "onboarding_cleanup",
    label: "Limpieza onboarding",
    description:
      "Cada día borra los archivos huérfanos que quedaron de formularios de onboarding sin terminar.",
    cadence: "daily",
    prefixes: ["onboarding_cleanup"],
  },
  {
    id: "whatsapp_dispatch",
    label: "Bot de WhatsApp",
    description:
      "Responde los mensajes pendientes del bot de WhatsApp. Solo se ejecuta cuando hay mensajes por responder, así que puede pasar días sin correr.",
    cadence: "on_demand",
    prefixes: ["whatsapp_ai_dispatch"],
  },
];

export const OTHER_GROUP: GroupDef = {
  id: "other",
  label: "Otras tareas",
  description: "Tareas programadas sin descripción en este panel.",
  cadence: "on_demand",
  prefixes: [],
};

/** Horas sin ejecución tras las que un grupo diario se considera atrasado. */
export const DAILY_MAX_GAP_HOURS = 26;
/** Días sin ejecución tras los que un grupo mensual se considera atrasado. */
export const MONTHLY_MAX_GAP_DAYS = 32;
/** Largo máximo del mensaje de error que se muestra. */
export const ERROR_MAX_LENGTH = 180;
/** Ventana de los conteos de ejecuciones. */
export const RUNS_WINDOW_DAYS = 7;

const HOUR_MS = 3_600_000;
const CHILE_TZ = "America/Santiago";

export function groupForJob(jobName: string): GroupDef {
  const name = jobName.trim();
  const found = AUTOMATION_GROUPS.find((g) =>
    g.prefixes.some((p) => name === p || name.startsWith(`${p}_`)),
  );
  return found ?? OTHER_GROUP;
}

// ---------------------------------------------------------------------------
// Errores: nunca mostrar URLs, tokens ni cuerpos HTML completos.
// ---------------------------------------------------------------------------

const KNOWN_ERRORS: ReadonlyArray<readonly [RegExp, string]> = [
  [/no HTTP response recorded/i, "Sin respuesta del servidor (tiempo agotado)."],
  [
    /DISPATCH_SECRET is not stored/i,
    "Falta configurar el secreto de despacho en la base de datos.",
  ],
  [/timed? ?out|timeout/i, "Tiempo de espera agotado."],
  [
    /unauthori[sz]ed|forbidden|\b401\b|\b403\b/i,
    "Acceso rechazado por el servidor (revisar secreto de despacho).",
  ],
];

function extractJsonMessage(raw: string): string | null {
  const t = raw.trim();
  if (!t.startsWith("{")) return null;
  try {
    const obj = JSON.parse(t) as Record<string, unknown>;
    for (const key of ["error", "message", "msg", "detail"]) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) return v;
      if (v && typeof v === "object" && typeof (v as { message?: unknown }).message === "string") {
        return (v as { message: string }).message;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Convierte un error crudo de job_runs en un texto corto y seguro:
 * quita etiquetas HTML, URLs (pueden llevar tokens en la query), JWT,
 * cabeceras de autorización y cadenas largas tipo secreto, y trunca.
 */
export function sanitizeError(
  raw: string | null | undefined,
  maxLength = ERROR_MAX_LENGTH,
): string | null {
  if (raw == null) return null;
  const source = String(raw);
  if (!source.trim()) return null;

  const known = KNOWN_ERRORS.find(([re]) => re.test(source));
  if (known && source.length < 400) return known[1];

  let text = extractJsonMessage(source) ?? source;
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[oculto]")
    .replace(/\b(bearer|basic)\s+[^\s"',;]+/gi, "$1 [oculto]")
    .replace(
      /\b([\w-]*(?:secret|token|key|password|apikey|authorization)[\w-]*)\s*([:=])\s*["']?[^\s"',;&]+/gi,
      "$1$2[oculto]",
    )
    .replace(/[A-Za-z0-9_\-+/=]{32,}/g, "[oculto]")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return known ? known[1] : "Error sin detalle.";
  if (text.length > maxLength) return `${text.slice(0, maxLength - 1).trimEnd()}…`;
  return text;
}

// ---------------------------------------------------------------------------
// Horario: cron (UTC) → texto en hora de Chile.
// ---------------------------------------------------------------------------

function chileTime(hourUtc: number, minuteUtc: number, now: Date): string {
  const at = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, minuteUtc),
  );
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: CHILE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

const isInt = (s: string) => /^\d+$/.test(s);

export interface ParsedSchedule {
  kind: "daily" | "monthly" | "interval" | "unknown";
  /** Hora de Chile HH:MM (daily/monthly). */
  time?: string;
  /** Día del mes (monthly). */
  day?: number;
  label: string;
}

/** Describe un horario de pg_cron (siempre en UTC) en hora de Chile. */
export function describeSchedule(schedule: string | null | undefined, now: Date): ParsedSchedule {
  const raw = (schedule ?? "").trim();
  if (!raw) return { kind: "unknown", label: "No programada" };

  const secs = /^(\d+)\s+seconds?$/i.exec(raw);
  if (secs) return { kind: "interval", label: `Cada ${secs[1]} segundos` };

  const parts = raw.split(/\s+/);
  if (parts.length !== 5) return { kind: "unknown", label: raw };
  const [min, hour, dom, mon, dow] = parts;

  if (min === "*" && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return { kind: "interval", label: "Cada minuto" };
  }
  const every = /^\*\/(\d+)$/.exec(min);
  if (every && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return { kind: "interval", label: `Cada ${every[1]} minutos` };
  }
  if (isInt(min) && isInt(hour) && mon === "*" && dow === "*") {
    const time = chileTime(Number(hour), Number(min), now);
    if (dom === "*") return { kind: "daily", time, label: `Todos los días a las ${time}` };
    if (isInt(dom)) {
      const day = Number(dom);
      return { kind: "monthly", time, day, label: `El día ${day} de cada mes a las ${time}` };
    }
  }
  return { kind: "unknown", label: raw };
}

/** Une los horarios de los jobs de un grupo (lotes) en un solo texto. */
export function describeGroupSchedule(schedules: ReadonlyArray<string | null>, now: Date): string {
  const parsed = schedules.map((s) => describeSchedule(s, now));
  if (parsed.length === 0) return "No programada";
  const scheduled = parsed.filter((p) => p.kind !== "unknown" || p.label !== "No programada");
  if (scheduled.length === 0) return "No programada";
  if (scheduled.length === 1) return scheduled[0].label;

  const kinds = new Set(scheduled.map((p) => p.kind));
  const days = new Set(scheduled.map((p) => p.day));
  if (kinds.size === 1 && (kinds.has("daily") || (kinds.has("monthly") && days.size === 1))) {
    const times = scheduled.map((p) => p.time ?? "").sort();
    const range =
      times[0] === times[times.length - 1] ? times[0] : `${times[0]}–${times[times.length - 1]}`;
    const lotes = `${scheduled.length} lotes`;
    return kinds.has("daily")
      ? `Todos los días, ${range} (${lotes})`
      : `El día ${scheduled[0].day} de cada mes, ${range} (${lotes})`;
  }
  return Array.from(new Set(scheduled.map((p) => p.label))).join(" · ");
}

// ---------------------------------------------------------------------------
// Estado por grupo y general.
// ---------------------------------------------------------------------------

export type RunStatus = "running" | "succeeded" | "failed" | "no_data";

export interface LatestRun {
  status: string;
  startedAt: string;
  error: string | null;
}

/** Lo que el servidor sabe de cada job (cron.job + su última ejecución). */
export interface JobSnapshot {
  name: string;
  /** null = el job no está en cron.job (solo hay historial). */
  active: boolean | null;
  schedule: string | null;
  latest: LatestRun | null;
}

export interface GroupCounts {
  total7d: number;
  failed7d: number;
  /** Último error (crudo) de los últimos 7 días, si hubo. */
  lastError: { error: string | null; startedAt: string } | null;
}

export type GroupStatus = "ok" | "error" | "late" | "never";
export type OverallStatus = "ok" | "warning" | "error" | "unknown";

export const GROUP_STATUS_LABEL: Readonly<Record<GroupStatus, string>> = {
  ok: "OK",
  error: "Con errores",
  late: "Atrasada",
  never: "Sin ejecutar",
};

export const OVERALL_LABEL: Readonly<Record<OverallStatus, string>> = {
  ok: "Todo en orden",
  warning: "Revisar",
  error: "Con errores",
  unknown: "Sin información",
};

export interface GroupReport {
  id: GroupId;
  label: string;
  description: string;
  cadence: Cadence;
  schedule: string;
  jobNames: string[];
  /** Lotes programados pero desactivados en cron. */
  inactiveJobs: number;
  lastRunAt: string | null;
  status: GroupStatus;
  statusLabel: string;
  /** ¿El estado requiere atención? (on_demand sin ejecutar no la requiere). */
  needsAttention: boolean;
  lastError: string | null;
  lastErrorAt: string | null;
  runs7d: number;
  failed7d: number;
  note: string | null;
}

const isFailed = (s: string) => s === "failed";

function maxGapMs(cadence: Cadence): number | null {
  if (cadence === "daily") return DAILY_MAX_GAP_HOURS * HOUR_MS;
  if (cadence === "monthly") return MONTHLY_MAX_GAP_DAYS * 24 * HOUR_MS;
  return null;
}

function latestOf(jobs: readonly JobSnapshot[]): LatestRun | null {
  return jobs.reduce<LatestRun | null>((best, j) => {
    if (!j.latest) return best;
    if (!best || j.latest.startedAt > best.startedAt) return j.latest;
    return best;
  }, null);
}

/**
 * Estado de un grupo:
 *  - never: ningún lote registra ejecuciones (job_runs guarda 30 días).
 *  - error: la última ejecución de algún lote falló.
 *  - late:  algún lote que ya corrió lleva más de lo esperado sin correr.
 *  - ok:    lo demás ("sin datos" cuenta como OK: corrió y no había nada que hacer).
 */
export function deriveGroupStatus(
  def: GroupDef,
  jobs: readonly JobSnapshot[],
  now: Date,
): GroupStatus {
  const ran = jobs.filter((j) => j.latest);
  if (ran.length === 0) return "never";
  if (ran.some((j) => isFailed(j.latest!.status))) return "error";
  const gap = maxGapMs(def.cadence);
  if (gap != null) {
    const scheduled = ran.filter((j) => j.active !== false);
    const late = scheduled.some(
      (j) => now.getTime() - new Date(j.latest!.startedAt).getTime() > gap,
    );
    if (late) return "late";
  }
  return "ok";
}

function needsAttention(def: GroupDef, status: GroupStatus): boolean {
  if (status === "error" || status === "late") return true;
  // Un grupo bajo demanda o mensual puede no haber corrido aún; uno diario no.
  return status === "never" && def.cadence === "daily";
}

function noteFor(
  def: GroupDef,
  status: GroupStatus,
  jobs: readonly JobSnapshot[],
  failed7d: number,
): string | null {
  if (jobs.every((j) => j.active == null || j.schedule == null)) {
    return "No está programada en la base de datos (revisar migraciones de cron).";
  }
  if (jobs.length > 0 && jobs.every((j) => j.active === false))
    return "Programada pero desactivada.";
  if (status === "never" && def.cadence === "monthly")
    return "Corre el día 1; el historial guarda 30 días.";
  if (status === "never" && def.cadence === "on_demand")
    return "Solo corre cuando hay trabajo pendiente.";
  if (status === "ok" && failed7d > 0)
    return `La última ejecución salió bien, pero hubo ${failed7d} fallo(s) en ${RUNS_WINDOW_DAYS} días.`;
  return null;
}

export function buildGroupReport(
  def: GroupDef,
  jobs: readonly JobSnapshot[],
  counts: GroupCounts | null,
  now: Date,
): GroupReport {
  const status = deriveGroupStatus(def, jobs, now);
  const latest = latestOf(jobs);
  const failedLatest = jobs
    .map((j) => j.latest)
    .filter((r): r is LatestRun => !!r && isFailed(r.status))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const errSource =
    failedLatest ?? (counts?.lastError ? { ...counts.lastError, status: "failed" } : null);
  const failed7d = counts?.failed7d ?? 0;

  return {
    id: def.id,
    label: def.label,
    description: def.description,
    cadence: def.cadence,
    schedule: describeGroupSchedule(
      jobs.filter((j) => j.active != null).map((j) => j.schedule),
      now,
    ),
    jobNames: jobs.map((j) => j.name).sort(),
    inactiveJobs: jobs.filter((j) => j.active === false).length,
    lastRunAt: latest?.startedAt ?? null,
    status,
    statusLabel: GROUP_STATUS_LABEL[status],
    needsAttention: needsAttention(def, status),
    lastError: errSource ? (sanitizeError(errSource.error) ?? "Falló sin mensaje de error.") : null,
    lastErrorAt: errSource?.startedAt ?? null,
    runs7d: counts?.total7d ?? 0,
    failed7d,
    note: noteFor(def, status, jobs, failed7d),
  };
}

/** Agrupa los jobs conocidos. Los grupos definidos siempre aparecen (aunque falten en cron). */
export function groupJobs(
  jobs: readonly JobSnapshot[],
): Array<{ def: GroupDef; jobs: JobSnapshot[] }> {
  const byId = new Map<GroupId, JobSnapshot[]>();
  for (const job of jobs) {
    const def = groupForJob(job.name);
    byId.set(def.id, [...(byId.get(def.id) ?? []), job]);
  }
  const defined = AUTOMATION_GROUPS.map((def) => ({ def, jobs: byId.get(def.id) ?? [] }));
  const others = byId.get("other");
  return others && others.length > 0 ? [...defined, { def: OTHER_GROUP, jobs: others }] : defined;
}

export function overallStatus(groups: readonly GroupReport[]): OverallStatus {
  if (groups.length === 0) return "unknown";
  if (groups.some((g) => g.status === "error")) return "error";
  if (groups.some((g) => g.needsAttention)) return "warning";
  if (groups.every((g) => g.status === "never")) return "unknown";
  return "ok";
}

export interface AutomationsReport {
  overall: OverallStatus;
  overallLabel: string;
  groups: GroupReport[];
  /** Grupos que requieren atención, para un resumen de una línea. */
  attention: string[];
}

export function buildAutomationsReport(
  jobs: readonly JobSnapshot[],
  countsByGroup: Readonly<Partial<Record<GroupId, GroupCounts>>>,
  now: Date,
): AutomationsReport {
  const groups = groupJobs(jobs).map(({ def, jobs: gj }) =>
    buildGroupReport(def, gj, countsByGroup[def.id] ?? null, now),
  );
  const overall = overallStatus(groups);
  return {
    overall,
    overallLabel: OVERALL_LABEL[overall],
    groups,
    attention: groups.filter((g) => g.needsAttention).map((g) => g.label),
  };
}
