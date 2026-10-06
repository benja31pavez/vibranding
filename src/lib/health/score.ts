/**
 * Reglas puras de "Salud del cliente": a partir de filas ya leídas de la BD
 * calcula Bien / Atención / En riesgo, con motivos y siguiente acción sugerida.
 *
 * - Sin E/S ni React: se prueba con datos falsos y `now` fijo (scripts/check-health.mjs).
 * - Fechas de calendario en America/Santiago.
 * - Solo clientes activos, en onboarding o pausados (prospecto/terminado → sin puntaje).
 * - Pausados: solo cobro vencido y renovación, y como máximo "Atención".
 * - Si alguna consulta llegó a su tope para un cliente → "Sin datos suficientes".
 */
import { addDaysYmd, chileDate } from "@/lib/dates/chile";
import { deriveMembership } from "@/lib/billing/membership";
import {
  HEALTH_MAX_SCORE,
  HEALTH_THRESHOLDS as T,
  HEALTH_WEIGHTS,
  SCORED_CLIENT_STATUSES,
} from "./thresholds";
import type {
  ClientHealth,
  HealthClientInput,
  HealthLevel,
  HealthReason,
  HealthSources,
} from "./types";

export const HEALTH_LEVEL_META: Readonly<
  Record<
    HealthLevel,
    { label: string; tone: "success" | "warning" | "danger" | "neutral"; rank: number }
  >
> = {
  en_riesgo: { label: "En riesgo", tone: "danger", rank: 0 },
  atencion: { label: "Atención", tone: "warning", rank: 1 },
  bien: { label: "Bien", tone: "success", rank: 2 },
  sin_datos: { label: "Sin datos suficientes", tone: "neutral", rank: 3 },
};
/** Rango de los clientes sin puntaje (prospecto/terminado): siempre al final. */
const UNSCORED_RANK = 4;

// ------------------------------------------------------------------ fechas

const DAY_MS = 86_400_000;

function ymdToUtc(ymd: string): number {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Días de calendario entre dos fechas YYYY-MM-DD: b - a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((ymdToUtc(b) - ymdToUtc(a)) / DAY_MS);
}

/** Fecha de calendario (Chile) de un ISO o de una columna `date`; null si no es válida. */
export function toYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : chileDate(d);
}

/** Suma meses de calendario; si el día no existe en el mes destino, usa el último. */
export function addMonthsYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Primer día del mes anterior al de `today` (mes cerrado). */
export function closedPeriod(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}

/** Desde qué fecha hay que buscar actividad. */
export function activitySince(today: string): string {
  return addDaysYmd(today, -T.activityLookbackDays);
}

const days = (n: number) => (n === 1 ? "1 día" : `${n} días`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ------------------------------------------------------------------ agrupación

function groupBy<T>(rows: readonly T[], key: (row: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    out.set(k, [...(out.get(k) ?? []), row]);
  }
  return out;
}

/** Mayor antigüedad (en días hasta hoy) entre fechas; null si no hay ninguna válida. */
function oldestAge(dates: readonly (string | null)[], today: string): number | null {
  const ages = dates.flatMap((d) => {
    const ymd = toYmd(d);
    return ymd ? [daysBetween(ymd, today)] : [];
  });
  return ages.length ? Math.max(...ages) : null;
}

function bySeverity(
  age: number,
  warnDays: number,
  riskDays: number,
): HealthReason["severity"] | null {
  if (age >= riskDays) return "risk";
  if (age >= warnDays) return "warning";
  return null;
}

// ------------------------------------------------------------------ reglas

interface ClientContext {
  client: HealthClientInput;
  today: string;
  startYmd: string;
}

type Grouped = {
  [K in keyof Omit<HealthSources, "clients" | "onboarding" | "partialClientIds">]: Map<
    string,
    HealthSources[K][number][]
  >;
};

function overdueReason(ctx: ClientContext, g: Grouped): HealthReason | null {
  const overdue = (g.payments.get(ctx.client.id) ?? []).filter(
    (p) =>
      p.status === "overdue" ||
      (p.status === "pending" && p.due_date !== null && p.due_date < ctx.today),
  );
  if (!overdue.length) return null;
  const age = Math.max(
    0,
    oldestAge(
      overdue.map((p) => p.due_date),
      ctx.today,
    ) ?? 0,
  );
  return {
    code: "cobro_vencido",
    severity: age >= T.overdueRiskDays ? "risk" : "warning",
    label: `${plural(overdue.length, "cobro vencido", "cobros vencidos")}, el más antiguo hace ${days(age)}`,
    action: "Llamar o escribir hoy para regularizar el pago y reenviar el link de cobro.",
  };
}

function approvalReason(ctx: ClientContext, g: Grouped): HealthReason | null {
  const items = g.approvals.get(ctx.client.id) ?? [];
  const age = oldestAge(
    items.map((a) => a.created_at),
    ctx.today,
  );
  if (age === null) return null;
  const severity = bySeverity(age, T.approvalWaitWarnDays, T.approvalWaitRiskDays);
  if (!severity) return null;
  return {
    code: "aprobacion_estancada",
    severity,
    label: `${plural(items.length, "pieza espera", "piezas esperan")} aprobación, la más antigua hace ${days(age)}`,
    action: "Recordarle al cliente qué falta aprobar (o agendar 15 min para revisarlo juntos).",
  };
}

function changesReason(ctx: ClientContext, g: Grouped): HealthReason | null {
  const items = g.changeRequests.get(ctx.client.id) ?? [];
  const age = oldestAge(
    items.map((c) => c.created_at),
    ctx.today,
  );
  if (age === null) return null;
  const severity = bySeverity(age, T.changeRequestWarnDays, T.changeRequestRiskDays);
  if (!severity) return null;
  return {
    code: "cambios_sin_resolver",
    severity,
    label: `${plural(items.length, "pedido de cambios", "pedidos de cambios")} sin resolver hace ${days(age)}`,
    action: "Aplicar los cambios pedidos y avisarle al cliente que ya están listos.",
  };
}

function alertsReason(ctx: ClientContext, g: Grouped): HealthReason | null {
  const open = g.alerts.get(ctx.client.id) ?? [];
  const critical = open.filter((a) => a.severity === "critical");
  const staleWarnings = open.filter((a) => {
    const ymd = toYmd(a.created_at);
    return (
      a.severity === "warning" && ymd !== null && daysBetween(ymd, ctx.today) >= T.alertWarnDays
    );
  });
  if (!critical.length && !staleWarnings.length) return null;
  const count = critical.length + staleWarnings.length;
  return {
    code: "alerta_campana",
    severity: critical.length ? "risk" : "warning",
    label: `${plural(count, "alerta de campaña abierta", "alertas de campaña abiertas")}${critical.length ? " (crítica)" : ""}`,
    action: "Revisar las campañas, corregir y marcar las alertas como resueltas.",
  };
}

function reportReason(ctx: ClientContext, g: Grouped): HealthReason | null {
  if (ctx.client.status !== "activo") return null;
  const period = closedPeriod(ctx.today);
  const dayOfMonth = Number(ctx.today.slice(8, 10));
  // Solo se exige si el cliente ya estaba antes de que empezara el mes cerrado.
  if (dayOfMonth < T.reportGraceDayOfMonth || ctx.startYmd >= period) return null;
  const sent = (g.reports.get(ctx.client.id) ?? []).some((r) => r.period === period && r.sent_at);
  if (sent) return null;
  return {
    code: "reporte_sin_enviar",
    severity: "warning",
    label: "Reporte del mes pasado sin enviar",
    action: "Generar y enviar el reporte mensual con los resultados del mes.",
  };
}

/** Días desde la última señal del cliente; la fecha de alta cuenta como señal. */
export function daysSinceActivity(ctx: ClientContext, g: Grouped): number {
  const stamps = (g.activity.get(ctx.client.id) ?? []).flatMap((a) => {
    const ymd = toYmd(a.at);
    return ymd ? [ymd] : [];
  });
  const latest = [ctx.startYmd, ...stamps].reduce((a, b) => (b > a ? b : a));
  return Math.max(0, daysBetween(latest, ctx.today));
}

function inactivityReason(ctx: ClientContext, inactiveDays: number): HealthReason | null {
  if (ctx.client.status !== "activo") return null;
  const severity = bySeverity(inactiveDays, T.inactivityWarnDays, T.inactivityRiskDays);
  if (!severity) return null;
  const label =
    inactiveDays > T.activityLookbackDays
      ? `Sin respuesta del cliente hace más de ${days(T.activityLookbackDays)}`
      : `Sin respuesta del cliente hace ${days(inactiveDays)}`;
  return {
    code: "sin_respuesta_cliente",
    severity,
    label,
    action: "Escribirle para saber cómo va y proponer el contenido de las próximas semanas.",
  };
}

/** Fin del período pagado en los últimos días y sin renovación (sin cobro automático). */
function renewalReason(ctx: ClientContext, g: Grouped): HealthReason | null {
  const m = deriveMembership(g.planPayments.get(ctx.client.id) ?? [], ctx.today);
  if (m.state !== "por_renovar" || m.renewed || m.daysLeft === null) return null;
  if (m.daysLeft > T.renewalWarnDays) return null;
  const left = m.daysLeft;
  return {
    code: "renovacion_cercana",
    severity: "warning",
    label:
      left === 0
        ? "Renovación próxima: el período pagado termina hoy"
        : `Renovación próxima: el período pagado termina en ${days(left)}`,
    action: "Agendar una reunión de resultados y proponer la renovación (o un plan mejor).",
  };
}

function onboardingReason(
  ctx: ClientContext,
  onboarding: HealthSources["onboarding"],
): HealthReason | null {
  const { id, status } = ctx.client;
  if (onboarding.submitted.includes(id)) return null;
  const pending =
    status === "onboarding" || (status === "activo" && onboarding.withToken.includes(id));
  if (!pending) return null;
  const age = daysBetween(ctx.startYmd, ctx.today);
  const severity = bySeverity(age, T.onboardingWarnDays, T.onboardingRiskDays);
  if (!severity) return null;
  return {
    code: "onboarding_incompleto",
    severity,
    label: `Onboarding sin completar hace ${days(age)}`,
    action: "Reenviar el link de onboarding y ofrecer completarlo juntos por videollamada.",
  };
}

// ------------------------------------------------------------------ puntaje

function levelOf(reasons: readonly HealthReason[], paused: boolean): HealthLevel {
  if (!reasons.length) return "bien";
  if (paused) return "atencion";
  if (reasons.some((r) => r.severity === "risk")) return "en_riesgo";
  return reasons.length >= T.warningsForRisk ? "en_riesgo" : "atencion";
}

/** Motivos que cuentan para un cliente pausado (no se le exige entrega ni respuesta). */
const PAUSED_REASONS: ReadonlySet<HealthReason["code"]> = new Set([
  "cobro_vencido",
  "renovacion_cercana",
]);

function scoreOf(reasons: readonly HealthReason[]): number {
  const penalty = reasons.reduce((sum, r) => sum + HEALTH_WEIGHTS[r.severity], 0);
  return Math.max(0, HEALTH_MAX_SCORE - penalty);
}

function scoreClient(
  client: HealthClientInput,
  g: Grouped,
  sources: HealthSources,
  today: string,
): ClientHealth {
  const startYmd = toYmd(client.started_at) ?? toYmd(client.created_at) ?? today;
  const ctx: ClientContext = { client, today, startYmd: startYmd > today ? today : startYmd };
  const inactiveDays = daysSinceActivity(ctx, g);
  const paused = client.status === "pausado";
  const reasons = [
    overdueReason(ctx, g),
    approvalReason(ctx, g),
    changesReason(ctx, g),
    alertsReason(ctx, g),
    renewalReason(ctx, g),
    onboardingReason(ctx, sources.onboarding),
    inactivityReason(ctx, inactiveDays),
    reportReason(ctx, g),
  ]
    .filter((r): r is HealthReason => r !== null)
    .filter((r) => !paused || PAUSED_REASONS.has(r.code))
    // Estable: los de riesgo primero, conservando el orden de prioridad de arriba.
    .sort((a, b) => Number(b.severity === "risk") - Number(a.severity === "risk"));
  return {
    clientId: client.id,
    level: levelOf(reasons, paused),
    score: scoreOf(reasons),
    reasons,
    nextAction: reasons[0]?.action ?? null,
    daysSinceActivity: client.status === "activo" ? inactiveDays : null,
  };
}

/** Salud de cada cliente con puntaje (Map por id). Los no puntuables no aparecen. */
export function computeClientHealth(sources: HealthSources, now: Date): Map<string, ClientHealth> {
  const today = chileDate(now);
  const g: Grouped = {
    payments: groupBy(sources.payments, (r) => r.client_id),
    approvals: groupBy(sources.approvals, (r) => r.client_id),
    changeRequests: groupBy(sources.changeRequests, (r) => r.client_id),
    alerts: groupBy(sources.alerts, (r) => r.client_id),
    reports: groupBy(sources.reports, (r) => r.client_id),
    activity: groupBy(sources.activity, (r) => r.client_id),
    planPayments: groupBy(sources.planPayments, (r) => r.client_id),
  };
  const partial = new Set(sources.partialClientIds);
  return new Map(
    sources.clients
      .filter((c) => SCORED_CLIENT_STATUSES.has(c.status))
      .map(
        (c) =>
          [
            c.id,
            partial.has(c.id) ? insufficient(c.id) : scoreClient(c, g, sources, today),
          ] as const,
      ),
  );
}

function insufficient(clientId: string): ClientHealth {
  return {
    clientId,
    level: "sin_datos",
    score: HEALTH_MAX_SCORE,
    reasons: [],
    nextAction: null,
    daysSinceActivity: null,
  };
}

/** Orden "En riesgo primero": nivel, luego puntaje (peor primero). Sin puntaje al final. */
export function compareByRisk(a: ClientHealth | undefined, b: ClientHealth | undefined): number {
  const rank = (h: ClientHealth | undefined) =>
    h ? HEALTH_LEVEL_META[h.level].rank : UNSCORED_RANK;
  return rank(a) - rank(b) || (a?.score ?? HEALTH_MAX_SCORE) - (b?.score ?? HEALTH_MAX_SCORE);
}

/** Cuántos clientes hay en cada nivel. */
export function countByLevel(health: Iterable<ClientHealth>): Record<HealthLevel, number> {
  const counts: Record<HealthLevel, number> = { bien: 0, atencion: 0, en_riesgo: 0, sin_datos: 0 };
  for (const h of health) counts[h.level] += 1;
  return counts;
}
