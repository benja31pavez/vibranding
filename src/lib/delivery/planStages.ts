/**
 * Etapas del plan de cada cliente, según el plan contratado.
 *
 * Cada plan tiene su propia plantilla de etapas (en orden) con un responsable
 * del equipo (ver `./team`). Para cambiar qué etapas ve cada plan, su orden, el
 * nombre o el responsable, edita solo `PLAN_TEMPLATES` y `STAGE_CATALOG`.
 *
 * En la base de datos una etapa es una fila de `deliverables` cuyo título
 * coincide con la etapa (su `due_date` es la fecha de entrega de la etapa); las
 * tareas viven en `client_tasks`. Mientras no se aplique la migración
 * `20261012001300_etapas_estandar.sql` (`stage_key`, `delivered_at`,
 * `approved_at`), la etapa de una tarea se deduce del marcador del plan del mes
 * o de palabras del título, y "entregada" se lee del estado `in_review`.
 */
import { readMarker, type MonthPlanKey } from "./monthPlan";
import { readTemplateMarker } from "./planChecklists";
import type { TeamMemberKey } from "./team";

// ─── Catálogo de etapas ─────────────────────────────────────────────────────

export const STAGE_KEYS = [
  "estrategia",
  "branding",
  "diseno",
  "planificacion",
  "contenido",
  "ads",
  "landing",
  "chatbot",
  "optimizacion",
  "reporte",
  "entrega",
] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export interface StageInfo {
  readonly label: string;
  readonly owner: TeamMemberKey;
  /** Qué incluye la etapa (se muestra al seleccionarla). */
  readonly detail: string;
}

/** Nombre, responsable y detalle por defecto de cada etapa. */
export const STAGE_CATALOG: Readonly<Record<StageKey, StageInfo>> = {
  estrategia: {
    label: "Estrategia",
    owner: "benjamin",
    detail: "Objetivos, público, propuesta de valor y líneas de comunicación.",
  },
  branding: {
    label: "Branding",
    owner: "antonia",
    detail: "Logo, paleta, tipografías y aplicaciones de marca.",
  },
  diseno: {
    label: "Diseño",
    owner: "antonia",
    detail: "Diseño de las piezas del mes (posts, carruseles, historias y reels).",
  },
  planificacion: {
    label: "Planificación de contenido",
    owner: "benjamin",
    detail: "Calendario, temas, copys y programación de publicaciones.",
  },
  contenido: {
    label: "Contenido",
    owner: "antonia",
    detail: "Producción de posts, carruseles y reels con su copy.",
  },
  ads: {
    label: "Ads (Meta / Google)",
    owner: "benjamin",
    detail: "Estructura de campañas, públicos, creativos y revisión semanal.",
  },
  landing: {
    label: "Landing Page",
    owner: "antonia",
    detail: "Página de captación con formulario y WhatsApp, textos y pruebas.",
  },
  chatbot: {
    label: "Chatbot",
    owner: "benjamin",
    detail: "Flujos de respuesta automática en WhatsApp (servicio adicional).",
  },
  optimizacion: {
    label: "Optimización",
    owner: "benjamin",
    detail: "Perfil de Instagram, ficha de Google Business y ajustes según resultados.",
  },
  reporte: {
    label: "Reporte",
    owner: "benjamin",
    detail: "Reporte mensual: qué funcionó, qué ajustar y próximos pasos.",
  },
  entrega: {
    label: "Entrega",
    owner: "benjamin",
    detail: "Entrega de archivos de marca, accesos y cierre del proyecto.",
  },
};

export function isStageKey(value: unknown): value is StageKey {
  return typeof value === "string" && (STAGE_KEYS as readonly string[]).includes(value);
}

// ─── Plantillas por plan ────────────────────────────────────────────────────

export type PlanView = "stages" | "people";

/** Una etapa dentro de un plan (permite renombrar o cambiar el responsable solo ahí). */
export interface PlanStageTemplate {
  readonly key: StageKey;
  readonly label?: string;
  readonly owner?: TeamMemberKey;
  /** Solo aparece si el cliente contrató este servicio adicional. */
  readonly addon?: AddonKey;
}

export interface PlanTemplate {
  readonly label: string;
  /** "people": el plan se muestra como tarjetas del equipo (Mantención). */
  readonly view: PlanView;
  readonly stages: readonly PlanStageTemplate[];
}

/** Servicios adicionales (`service_pricing.service_key`). */
export type AddonKey = "chatbot" | "landing";
const ADDON_STAGE: Readonly<Record<AddonKey, StageKey>> = {
  chatbot: "chatbot",
  landing: "landing",
};

/** Plantillas de etapas por `client_billing.plan_key`. Edita aquí. */
export const PLAN_TEMPLATES: Readonly<Record<string, PlanTemplate>> = {
  mantencion: {
    label: "Plan Mantención",
    view: "people",
    stages: [{ key: "diseno" }, { key: "planificacion" }],
  },
  contenido: {
    label: "Plan Contenido",
    view: "stages",
    stages: [
      { key: "estrategia" },
      { key: "diseno" },
      { key: "planificacion" },
      { key: "reporte" },
    ],
  },
  crecimiento: {
    label: "Plan Crecimiento",
    view: "stages",
    stages: [
      { key: "estrategia" },
      { key: "branding", label: "Branding / Diseño" },
      { key: "contenido" },
      { key: "ads" },
      { key: "landing" },
      { key: "chatbot", addon: "chatbot" },
      { key: "optimizacion" },
      { key: "reporte" },
    ],
  },
  "marca-web": {
    label: "Marca + Web",
    view: "stages",
    stages: [{ key: "branding" }, { key: "landing", label: "Landing / Web" }, { key: "entrega" }],
  },
};

/** Sin plan (o con una clave desconocida): todas las etapas del plan completo. */
export const FALLBACK_PLAN_KEY = "crecimiento";

export interface PlanStage {
  readonly key: StageKey;
  readonly label: string;
  readonly owner: TeamMemberKey;
  readonly detail: string;
}

export interface ResolvedPlan {
  /** Clave del plan usada (null si el cliente no tiene plan conocido). */
  readonly planKey: string | null;
  readonly label: string;
  readonly view: PlanView;
  readonly stages: readonly PlanStage[];
}

function toStage(t: PlanStageTemplate): PlanStage {
  const info = STAGE_CATALOG[t.key];
  return {
    key: t.key,
    label: t.label ?? info.label,
    owner: t.owner ?? info.owner,
    detail: info.detail,
  };
}

/** "Mantención" / "mantencion" / " Crecimiento " → clave de plantilla. */
export function normalizePlanKey(planKey: string | null | undefined): string | null {
  const key = (planKey ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return key in PLAN_TEMPLATES ? key : null;
}

/**
 * Etapas del cliente según su plan y servicios adicionales contratados. Un
 * adicional que el plan no trae (p. ej. Chatbot en Contenido) se agrega al final.
 */
export function resolvePlan(
  planKey: string | null | undefined,
  addons: readonly string[],
): ResolvedPlan {
  const key = normalizePlanKey(planKey);
  const template = PLAN_TEMPLATES[key ?? FALLBACK_PLAN_KEY];
  const has = (addon: AddonKey) => addons.includes(addon);
  const base = template.stages.filter((s) => !s.addon || has(s.addon));
  const present = new Set(base.map((s) => s.key));
  const extras = (Object.keys(ADDON_STAGE) as AddonKey[])
    .filter((addon) => has(addon) && !present.has(ADDON_STAGE[addon]))
    .map((addon): PlanStageTemplate => ({ key: ADDON_STAGE[addon] }));
  return {
    planKey: key,
    label: key ? template.label : "Sin plan asignado",
    view: template.view,
    stages: [...base, ...extras].map(toStage),
  };
}

/** Clave del "Plan del mes" para un plan con plantilla (null si no hay plan). */
export function toMonthPlanKey(planKey: string | null | undefined): MonthPlanKey | null {
  const key = normalizePlanKey(planKey);
  return key === "mantencion" || key === "contenido" || key === "crecimiento" || key === "marca-web"
    ? key
    : null;
}

// ─── A qué etapa pertenece cada fila ────────────────────────────────────────

/** Minúsculas, sin tildes ni espacios repetidos. */
export function normalizeText(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Títulos de etapa conocidos (normalizados), incluidos nombres antiguos. */
const TITLE_ALIASES: Readonly<Record<string, StageKey>> = {
  estrategia: "estrategia",
  branding: "branding",
  "branding / diseno": "branding",
  marca: "branding",
  "identidad de marca": "branding",
  "kit de marca": "branding",
  diseno: "diseno",
  "planificacion de contenido": "planificacion",
  planificacion: "planificacion",
  contenido: "contenido",
  "plan de contenido": "contenido",
  ads: "ads",
  "ads (meta / google)": "ads",
  "meta ads": "ads",
  publicidad: "ads",
  campanas: "ads",
  "landing page": "landing",
  "landing / web": "landing",
  landing: "landing",
  "pagina web": "landing",
  "sitio web": "landing",
  web: "landing",
  chatbot: "chatbot",
  "chatbot whatsapp": "chatbot",
  optimizacion: "optimizacion",
  "optimizacion de perfil": "optimizacion",
  reporte: "reporte",
  "reporte mensual": "reporte",
  entrega: "entrega",
};

/** Etapa de una fila de `deliverables` por su título exacto; null si no es una etapa. */
export function stageKeyFromTitle(title: string | null | undefined): StageKey | null {
  return TITLE_ALIASES[normalizeText(title)] ?? null;
}

/**
 * Si la etapa deducida no existe en el plan del cliente, se prueba con la más
 * parecida (p. ej. un post es "Contenido" en Crecimiento y "Diseño" en Mantención).
 */
const STAGE_FALLBACKS: Readonly<Record<StageKey, readonly StageKey[]>> = {
  estrategia: ["estrategia", "planificacion"],
  branding: ["branding", "diseno"],
  diseno: ["diseno", "branding", "contenido"],
  planificacion: ["planificacion", "contenido", "estrategia"],
  contenido: ["contenido", "diseno", "branding"],
  ads: ["ads"],
  landing: ["landing"],
  chatbot: ["chatbot"],
  optimizacion: ["optimizacion", "entrega", "planificacion"],
  reporte: ["reporte", "estrategia"],
  entrega: ["entrega", "landing"],
};

export function fitToPlan(key: StageKey | null, planStages: readonly StageKey[]): StageKey | null {
  if (!key) return null;
  return STAGE_FALLBACKS[key].find((k) => planStages.includes(k)) ?? null;
}

/** Tipo de tarea del plan del mes (marcador `[plan-mes:AAAA-MM:tipo-n]`) → etapa. */
const MONTH_PLAN_KIND_STAGE: Readonly<Record<string, StageKey>> = {
  calendario: "planificacion",
  post: "contenido",
  reel: "contenido",
  google: "optimizacion",
  campanas: "ads",
  reporte: "reporte",
  reunion: "estrategia",
  inicio: "branding",
  "kit-marca": "branding",
  landing: "landing",
  ajustes: "landing",
  "google-business": "optimizacion",
  pruebas: "landing",
  entrega: "entrega",
};

function stageFromMarker(description: string | null | undefined): StageKey | null {
  const template = readTemplateMarker(description);
  if (template && isStageKey(template.stage)) return template.stage;
  const marker = readMarker(description);
  if (!marker) return null;
  const kind = marker.key in MONTH_PLAN_KIND_STAGE ? marker.key : marker.key.replace(/-\d+$/, "");
  return MONTH_PLAN_KIND_STAGE[kind] ?? null;
}

/** Palabras del título → etapa (en orden: la primera que coincide gana). */
const KEYWORD_STAGES: readonly (readonly [RegExp, StageKey])[] = [
  [/\b(chatbot|bot de whatsapp|flujo de whatsapp|respuestas automaticas)\b/, "chatbot"],
  [/\b(landing|pagina web|sitio web|formulario)\b/, "landing"],
  [/\b(ads|anuncio|anuncios|campana|campanas|pauta|publicidad)\b/, "ads"],
  [/\b(reporte|informe|metricas|resultados del mes)\b/, "reporte"],
  [/\b(logo|logotipo|paleta|tipografia|tipografias|kit de marca|branding|identidad)\b/, "branding"],
  [/\b(calendario|planificacion|programar|programacion|copy|copys|parrilla)\b/, "planificacion"],
  [/\b(google business|perfil|bio|optimiz\w*|seo|destacadas)\b/, "optimizacion"],
  [/\b(estrategia|publico objetivo|buyer|reunion|propuesta de valor)\b/, "estrategia"],
  [/\b(entrega|cierre|traspaso)\b/, "entrega"],
  [/\b(post|posts|reel|reels|historia|historias|carrusel|pieza|piezas|contenido)\b/, "contenido"],
  [/\b(diseno|disenar|arte|mockup)\b/, "diseno"],
];

function stageFromKeywords(title: string | null | undefined): StageKey | null {
  const text = normalizeText(title);
  if (!text) return null;
  return KEYWORD_STAGES.find(([re]) => re.test(text))?.[1] ?? null;
}

export interface StageTaskLike {
  readonly title: string;
  readonly description?: string | null;
  /** Solo existe cuando se aplicó la migración de etapas. */
  readonly stage_key?: string | null;
}

/**
 * Etapa de una tarea dentro del plan del cliente: columna `stage_key` →
 * marcador de plantilla o del plan del mes → palabras del título; luego se ajusta al plan.
 */
export function taskStageKey(
  task: StageTaskLike,
  planStages: readonly StageKey[],
): StageKey | null {
  if (isStageKey(task.stage_key) && planStages.includes(task.stage_key)) return task.stage_key;
  const guess = isStageKey(task.stage_key)
    ? task.stage_key
    : (stageFromMarker(task.description) ?? stageFromKeywords(task.title));
  return fitToPlan(guess, planStages);
}

// ─── Tablero y entrega ──────────────────────────────────────────────────────

/** Estado real (guardado) de una tarea, agrupado: Pendiente / En proceso / Entregado. */
export type TaskState = "todo" | "doing" | "done";
export const TASK_STATES: readonly TaskState[] = ["todo", "doing", "done"];

/**
 * Columna del tablero. "late" (Atrasado) es derivado: tarea no entregada cuya
 * fecha ya pasó (en hora de Chile). Nunca se guarda.
 */
export type BoardColumn = TaskState | "late";
export const BOARD_COLUMNS: readonly BoardColumn[] = ["todo", "doing", "late", "done"];

export const BOARD_COLUMN_LABELS: Readonly<Record<BoardColumn, string>> = {
  todo: "Pendiente",
  doing: "En proceso",
  late: "Atrasado",
  done: "Entregado",
};

/** `task_status` → estado. `in_review` = entregada al cliente: cuenta como entregada. */
export function taskColumn(status: string): TaskState {
  if (status === "done" || status === "in_review") return "done";
  if (status === "in_progress") return "doing";
  return "todo";
}

export interface LateTaskLike {
  readonly status: string;
  readonly due_date: string | null;
}

/** Atrasada: no entregada y su fecha (YYYY-MM-DD) es anterior a hoy (`today` en hora de Chile). */
export function isTaskLate(task: LateTaskLike, today: string): boolean {
  return (
    Boolean(task.due_date && task.due_date.slice(0, 10) < today) &&
    taskColumn(task.status) !== "done"
  );
}

/** Columna donde se muestra la tarea en el tablero (las atrasadas van a "Atrasado"). */
export function boardColumn(task: LateTaskLike, today: string): BoardColumn {
  return isTaskLate(task, today) ? "late" : taskColumn(task.status);
}

/** Estado → `task_status` que se guarda. */
export const COLUMN_STATUS: Readonly<Record<TaskState, "pending" | "in_progress" | "done">> = {
  todo: "pending",
  doing: "in_progress",
  done: "done",
};

/**
 * Estado de entrega. En el Plan "done" y "delivered" se muestran igual
 * (Entregado, ✓✓ verde, con la fecha de entrega si se guardó);
 * "approved" agrega que el cliente la aprobó (✓✓ azul); "open" = sin entregar.
 */
export type DeliveryState = "open" | "done" | "delivered" | "approved";

export const DELIVERY_LABELS: Readonly<Record<DeliveryState, string>> = {
  open: "Sin entregar",
  done: "Entregado",
  delivered: "Entregado al cliente",
  approved: "Aprobado por el cliente",
};

export interface DeliveryTaskLike {
  readonly status: string;
  readonly delivered_at?: string | null;
  readonly approved_at?: string | null;
}

export function deliveryState(task: DeliveryTaskLike): DeliveryState {
  if (task.approved_at) return "approved";
  if (task.delivered_at || task.status === "in_review") return "delivered";
  return task.status === "done" ? "done" : "open";
}

// ─── Resumen por etapa ──────────────────────────────────────────────────────

export type StageStatus = "pending" | "active" | "done";

export const STAGE_STATUS_LABELS: Readonly<Record<StageStatus, string>> = {
  pending: "Pendiente",
  active: "En proceso",
  done: "Entregada",
};

export interface StageRowLike {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly due_date: string | null;
  readonly sort_order: number;
  readonly stage_key?: string | null;
}

export interface StageTask extends StageTaskLike, DeliveryTaskLike {
  readonly due_date: string | null;
}

export interface StageSummary extends PlanStage {
  readonly status: StageStatus;
  readonly done: number;
  readonly total: number;
  /** 0–100. */
  readonly pct: number;
  readonly delivered: number;
  /** Fecha de entrega de la etapa o, si no tiene, la última fecha de sus tareas. */
  readonly dueDate: string | null;
  /** Fecha vencida con la etapa sin terminar. */
  readonly late: boolean;
  /** Fila de `deliverables` que representa la etapa (si existe). */
  readonly rowId: string | null;
}

/** Fila de `deliverables` que representa cada etapa del plan (la primera por orden). */
export function stageRows<T extends StageRowLike>(
  rows: readonly T[],
  planStages: readonly StageKey[],
): Map<StageKey, T> {
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
  return sorted.reduce((map, row) => {
    const raw = isStageKey(row.stage_key) ? row.stage_key : stageKeyFromTitle(row.title);
    const key = fitToPlan(raw, planStages);
    return key && !map.has(key) ? new Map(map).set(key, row) : map;
  }, new Map<StageKey, T>());
}

function latest(dates: readonly (string | null)[]): string | null {
  return dates.reduce<string | null>((max, d) => (d && (!max || d > max) ? d : max), null);
}

function stageStatus(
  row: StageRowLike | undefined,
  done: number,
  doing: number,
  total: number,
): StageStatus {
  if (row?.status === "done") return "done";
  if (!row && total > 0 && done === total) return "done";
  if (row && row.status !== "pending") return "active";
  return done > 0 || doing > 0 ? "active" : "pending";
}

export interface SummarizeInput {
  readonly plan: ResolvedPlan;
  readonly rows: readonly StageRowLike[];
  readonly tasks: readonly StageTask[];
  /** Hoy ("YYYY-MM-DD"). */
  readonly today: string;
}

/** Resumen de las etapas del plan, en el orden de la plantilla. */
export function summarizeStages({ plan, rows, tasks, today }: SummarizeInput): StageSummary[] {
  const keys = plan.stages.map((s) => s.key);
  const byStage = stageRows(rows, keys);
  return plan.stages.map((stage) => {
    const own = tasks.filter((t) => taskStageKey(t, keys) === stage.key);
    const done = own.filter((t) => taskColumn(t.status) === "done").length;
    const doing = own.filter((t) => taskColumn(t.status) === "doing").length;
    const delivered = own.filter((t) => {
      const state = deliveryState(t);
      return state === "delivered" || state === "approved";
    }).length;
    const row = byStage.get(stage.key);
    const status = stageStatus(row, done, doing, own.length);
    const dueDate = row?.due_date ?? latest(own.map((t) => t.due_date));
    return {
      ...stage,
      status,
      done,
      total: own.length,
      pct: own.length > 0 ? Math.round((done / own.length) * 100) : status === "done" ? 100 : 0,
      delivered,
      dueDate,
      late: Boolean(dueDate && dueDate < today && status !== "done"),
      rowId: row?.id ?? null,
    };
  });
}

export interface MemberSummary {
  readonly owner: TeamMemberKey;
  readonly stages: readonly StageKey[];
  readonly done: number;
  readonly total: number;
  readonly pct: number;
  readonly dueDate: string | null;
  readonly late: boolean;
}

/** Avance por responsable (vista "people" de Mantención). */
export function summarizeByOwner(stages: readonly StageSummary[]): MemberSummary[] {
  const owners = [...new Set(stages.map((s) => s.owner))];
  return owners.map((owner) => {
    const own = stages.filter((s) => s.owner === owner);
    const done = own.reduce((n, s) => n + s.done, 0);
    const total = own.reduce((n, s) => n + s.total, 0);
    const open = own.filter((s) => s.status !== "done");
    const dueDate = open
      .map((s) => s.dueDate)
      .reduce<string | null>((min, d) => (d && (!min || d < min) ? d : min), null);
    return {
      owner,
      stages: own.map((s) => s.key),
      done,
      total,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      dueDate,
      late: own.some((s) => s.late),
    };
  });
}

// ─── Estado visible (pastillas del recorrido) ───────────────────────────────

/** Estado que se muestra en la pastilla de una etapa o persona. */
export type TrackStatus = StageStatus | "late";

export const TRACK_STATUS_LABELS: Readonly<Record<TrackStatus, string>> = {
  ...STAGE_STATUS_LABELS,
  late: "Atrasada",
};

/** Lo atrasado manda sobre "Pendiente" / "En proceso"; una etapa entregada nunca está atrasada. */
export function trackStatus(status: StageStatus, late: boolean): TrackStatus {
  return late && status !== "done" ? "late" : status;
}

/** Estado de una persona (Mantención) a partir de sus etapas. */
export function memberStatus(stages: readonly StageSummary[]): TrackStatus {
  if (stages.some((s) => s.late && s.status !== "done")) return "late";
  if (stages.length > 0 && stages.every((s) => s.status === "done")) return "done";
  return stages.some((s) => s.status !== "pending") ? "active" : "pending";
}

export type PlanStatus = "not_started" | "active" | "on_track" | "late";

export const PLAN_STATUS_LABELS: Readonly<Record<PlanStatus, string>> = {
  not_started: "Sin empezar",
  active: "En proceso",
  on_track: "Al día",
  late: "Atrasado",
};

export interface PlanSummary {
  readonly done: number;
  readonly total: number;
  /** 0–100. */
  readonly pct: number;
  readonly status: PlanStatus;
  /** Fecha de entrega más próxima entre las etapas sin terminar. */
  readonly nextDue: string | null;
}

/**
 * Resumen del plan completo ("General"): tareas listas sobre el total, estado
 * (atrasado si alguna etapa está atrasada; al día si todo está listo) y la
 * próxima fecha de entrega.
 */
export function summarizePlan(stages: readonly StageSummary[]): PlanSummary {
  const done = stages.reduce((n, s) => n + s.done, 0);
  const total = stages.reduce((n, s) => n + s.total, 0);
  const open = stages.filter((s) => s.status !== "done");
  const nextDue = open
    .map((s) => s.dueDate)
    .reduce<string | null>((min, d) => (d && (!min || d < min) ? d : min), null);
  const status: PlanStatus = open.some((s) => s.late)
    ? "late"
    : stages.length > 0 && open.length === 0
      ? "on_track"
      : done === 0 && stages.every((s) => s.status === "pending")
        ? "not_started"
        : "active";
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0, status, nextDue };
}
