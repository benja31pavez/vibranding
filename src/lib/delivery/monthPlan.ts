/**
 * "Plan del mes": convierte lo que incluye cada plan en una lista de tareas
 * internas con fecha (días hábiles lun–vie, calendario de Chile).
 *
 * Funciones puras: sin Supabase ni reloj. Las fechas son "YYYY-MM-DD" ya
 * expresadas en America/Santiago (el llamador entrega `today` con chileToday()).
 * Días hábiles = lun–vie sin feriados nacionales de Chile (CL_HOLIDAYS, cubre
 * 2026–2027; actualizar cada año). Si se genera el mes en curso, las cantidades
 * se prorratean según los días hábiles que quedan; el mes siguiente va completo.
 */
import type { PlanKey } from "@/lib/pricing/plans";

// ─── Lo que incluye cada plan (fuente: home y "primeros 30 días") ───────────

/** Semanas que cubre la cuota mensual (12 piezas = 3 por semana × 4). */
export const WEEKS_PER_MONTH = 4;

/** Plan Contenido: 12 piezas al mes, 4 publicaciones en Google Business, reporte. */
export const CONTENIDO = {
  postsPerWeek: 2,
  reelsPerWeek: 1,
  googleBusinessPerMonth: 4,
  monthlyReport: true,
  monthlyMeeting: true,
} as const;

/** Plan Crecimiento: todo lo de Contenido + revisión semanal de campañas. */
export const CRECIMIENTO = {
  ...CONTENIDO,
  campaignReviewsPerWeek: 1,
} as const;

/** Marca + Web (pago único): pasos del proyecto, repartidos en el mes de entrega. */
export const MARCA_WEB_STEPS = [
  { key: "inicio", title: "Reunión de inicio y recepción de información", at: 0 },
  { key: "kit-marca", title: "Kit de marca: primera versión (logo, colores y tipografías)", at: 0.15 },
  { key: "landing", title: "Landing: primera versión con WhatsApp y formulario", at: 0.25 },
  { key: "ajustes", title: "Ajustes solicitados por el cliente", at: 0.45 },
  { key: "google-business", title: "Optimizar ficha de Google Business", at: 0.55 },
  { key: "pruebas", title: "Pruebas: formularios, WhatsApp y vista en celular", at: 0.7 },
  { key: "entrega", title: "Entrega de archivos de marca y cierre", at: 1 },
] as const;

/** Prefijo del marcador estable guardado en la descripción: [plan-mes:2026-10:post-3]. */
export const MARKER_PREFIX = "plan-mes";
const MARKER_RE = /\[plan-mes:(\d{4}-\d{2}):([a-z0-9-]+)\]/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const DAY_MS = 86_400_000;

/**
 * Feriados nacionales de Chile (todos, aunque caigan en fin de semana; los
 * regionales no se incluyen). Fuente: feriados.cl (2026.htm y 2027.php),
 * revisado el 2026-10-05. Feriados movidos por ley: en 2026 el 12-oct cae
 * lunes y el 31-oct sábado (sin traslado); en 2027 San Pedro y San Pablo pasa
 * al lun 28-jun, Encuentro de Dos Mundos al lun 11-oct, y el vie 17-sep es
 * feriado adicional. Cubre 2026–2027: ampliar antes de 2028 (check:month-plan falla).
 */
export const CL_HOLIDAYS_LAST_YEAR = 2027;
export const CL_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2026
  "2026-01-01", "2026-04-03", "2026-04-04", "2026-05-01", "2026-05-21", "2026-06-21",
  "2026-06-29", "2026-07-16", "2026-08-15", "2026-09-18", "2026-09-19", "2026-10-12",
  "2026-10-31", "2026-11-01", "2026-12-08", "2026-12-25",
  // 2027
  "2027-01-01", "2027-03-26", "2027-03-27", "2027-05-01", "2027-05-21", "2027-06-21",
  "2027-06-28", "2027-07-16", "2027-08-15", "2027-09-17", "2027-09-18", "2027-09-19",
  "2027-10-11", "2027-10-31", "2027-11-01", "2027-12-08", "2027-12-25",
]);

/** Bajo este número de días hábiles restantes se avisa en la vista previa. */
export const FEW_BUSINESS_DAYS = 5;
const SATURDAY = 6;
const SUNDAY = 0;

export type MonthPlanKind =
  | "calendario"
  | "post"
  | "reel"
  | "google"
  | "campanas"
  | "reporte"
  | "reunion"
  | "proyecto";

export interface MonthPlanItem {
  /** Clave estable dentro del mes (p. ej. "post-3"); forma parte del marcador. */
  readonly key: string;
  readonly kind: MonthPlanKind;
  readonly title: string;
  /** Texto para `description`; termina con el marcador del plan del mes. */
  readonly description: string;
  /** "YYYY-MM-DD" (día hábil en Chile). */
  readonly dueDate: string;
}

export interface BuildMonthPlanInput {
  readonly planKey: PlanKey;
  /** "YYYY-MM". */
  readonly month: string;
  /** Hoy en Chile ("YYYY-MM-DD"). Si cae dentro del mes, no se agenda nada antes. */
  readonly today?: string;
}

// ─── Fechas ─────────────────────────────────────────────────────────────────

export function isMonthKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = MONTH_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return year >= MIN_YEAR && year <= MAX_YEAR && month >= 1 && month <= 12;
}

function utc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Primer y último día del mes ("YYYY-MM-DD"). */
export function monthBounds(month: string): { first: string; last: string } {
  const [y, m] = month.split("-").map(Number);
  return { first: `${month}-01`, last: ymd(new Date(Date.UTC(y, m, 0))) };
}

/** Mes siguiente ("YYYY-MM"). */
export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return ymd(new Date(Date.UTC(y, m, 1))).slice(0, 7);
}

/** Días hábiles (lun–vie, sin feriados CL_HOLIDAYS) del mes, desde `from` inclusive si cae dentro del mes. */
export function businessDays(month: string, from?: string): string[] {
  const { first, last } = monthBounds(month);
  const start = from && DAY_RE.test(from) && from > first ? from : first;
  const out: string[] = [];
  for (let t = utc(start).getTime(); t <= utc(last).getTime(); t += DAY_MS) {
    const day = new Date(t);
    const weekday = day.getUTCDay();
    const key = ymd(day);
    if (weekday !== SATURDAY && weekday !== SUNDAY && !CL_HOLIDAYS.has(key)) out.push(key);
  }
  return out;
}

/** `count` días repartidos de forma pareja (centro de cada tramo). */
export function spreadEvenly(days: readonly string[], count: number): string[] {
  if (days.length === 0 || count <= 0) return [];
  return Array.from({ length: count }, (_, i) => days[Math.floor(((i + 0.5) * days.length) / count)]);
}

/** Día en la posición relativa `at` (0 = primero, 1 = último). */
function dayAt(days: readonly string[], at: number): string {
  const clamped = Math.min(Math.max(at, 0), 1);
  return days[Math.round(clamped * (days.length - 1))];
}

/** Primer día hábil de cada semana (lun–dom) que tenga días disponibles. */
function firstDayPerWeek(days: readonly string[]): string[] {
  const seen = new Set<string>();
  return days.filter((d) => {
    const date = utc(d);
    const monday = ymd(new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS));
    if (seen.has(monday)) return false;
    seen.add(monday);
    return true;
  });
}

// ─── Marcador ───────────────────────────────────────────────────────────────

export function planMarker(month: string, key: string): string {
  return `[${MARKER_PREFIX}:${month}:${key}]`;
}

/** Lee el marcador de una descripción; null si no tiene. */
export function readMarker(description: string | null | undefined): { month: string; key: string } | null {
  const m = MARKER_RE.exec(description ?? "");
  return m ? { month: m[1], key: m[2] } : null;
}

function describe(text: string, month: string, key: string): string {
  return `${text}\n\n${planMarker(month, key)}`;
}

// ─── Construcción ───────────────────────────────────────────────────────────

const INTERNAL_NOTE = "Tarea interna generada con el plan del mes. No se publica ni se envía al cliente.";

function numbered(
  kind: MonthPlanKind,
  label: string,
  detail: string,
  dates: readonly string[],
  month: string,
): MonthPlanItem[] {
  return dates.map((dueDate, i) => {
    const key = `${kind}-${i + 1}`;
    return {
      key,
      kind,
      title: `${label} ${i + 1}/${dates.length}`,
      description: describe(`${detail} ${INTERNAL_NOTE}`, month, key),
      dueDate,
    };
  });
}

function single(
  kind: MonthPlanKind,
  key: string,
  title: string,
  detail: string,
  dueDate: string,
  month: string,
): MonthPlanItem {
  return { key, kind, title, description: describe(`${detail} ${INTERNAL_NOTE}`, month, key), dueDate };
}

/** Cantidad proporcional a los días que quedan (al menos 1 si la cuota es > 0). */
export function prorate(count: number, ratio: number): number {
  if (count <= 0) return 0;
  return Math.max(1, Math.round(count * Math.min(Math.max(ratio, 0), 1)));
}

function contentItems(
  days: readonly string[],
  month: string,
  withCampaigns: boolean,
  ratio: number,
): MonthPlanItem[] {
  const plan = withCampaigns ? CRECIMIENTO : CONTENIDO;
  const items: MonthPlanItem[] = [
    single(
      "calendario",
      "calendario",
      "Calendario de contenido y copy del mes",
      "Definir temas, formatos y textos; dejarlo listo para aprobación.",
      dayAt(days, 0),
      month,
    ),
    ...numbered(
      "post",
      "Post / carrusel",
      "Diseño y copy de la pieza, en borrador para aprobación.",
      spreadEvenly(days, prorate(plan.postsPerWeek * WEEKS_PER_MONTH, ratio)),
      month,
    ),
    ...numbered(
      "reel",
      "Reel",
      "Guion, edición y copy del reel, en borrador para aprobación.",
      spreadEvenly(days, prorate(plan.reelsPerWeek * WEEKS_PER_MONTH, ratio)),
      month,
    ),
    ...numbered(
      "google",
      "Publicación Google Business",
      "Preparar la publicación de la ficha de Google Business.",
      spreadEvenly(days, prorate(plan.googleBusinessPerMonth, ratio)),
      month,
    ),
  ];

  if (withCampaigns) {
    const weeks = firstDayPerWeek(days);
    items.push(
      ...numbered(
        "campanas",
        "Revisión de campañas Meta y Google Ads",
        "Revisar gasto, anuncios y segmentación; anotar ajustes.",
        weeks.flatMap((d) => Array.from({ length: CRECIMIENTO.campaignReviewsPerWeek }, () => d)),
        month,
      ),
    );
  }

  const last = dayAt(days, 1);
  if (plan.monthlyReport) {
    items.push(
      single(
        "reporte",
        "reporte",
        withCampaigns ? "Reporte mensual de resultados" : "Reporte mensual",
        "Preparar el reporte del mes (lo que funcionó y qué ajustar). Revisarlo antes de enviarlo.",
        last,
        month,
      ),
    );
  }
  if (plan.monthlyMeeting) {
    items.push(
      single(
        "reunion",
        "reunion",
        "Reunión de revisión del mes",
        "Coordinar con el cliente la revisión del mes y el plan del siguiente.",
        last,
        month,
      ),
    );
  }
  return items;
}

function projectItems(days: readonly string[], month: string): MonthPlanItem[] {
  return MARCA_WEB_STEPS.map((step) =>
    single("proyecto", step.key, step.title, "Paso del proyecto Marca + Web.", dayAt(days, step.at), month),
  );
}

const KIND_ORDER: Readonly<Record<MonthPlanKind, number>> = {
  calendario: 0,
  proyecto: 1,
  post: 2,
  reel: 3,
  google: 4,
  campanas: 5,
  reporte: 6,
  reunion: 7,
};

/**
 * Tareas del mes para el plan del cliente, ordenadas por fecha. Lista vacía si
 * el mes no es válido o ya no quedan días hábiles (mes pasado).
 */
export function buildMonthPlan({ planKey, month, today }: BuildMonthPlanInput): MonthPlanItem[] {
  if (!isMonthKey(month)) return [];
  const days = businessDays(month, today);
  if (days.length === 0) return [];
  // Mes en curso: cuotas proporcionales a los días hábiles que quedan.
  const ratio = days.length / businessDays(month).length;
  const items =
    planKey === "marca-web"
      ? projectItems(days, month)
      : contentItems(days, month, planKey === "crecimiento", ratio);
  return [...items].sort((a, b) =>
    a.dueDate === b.dueDate ? KIND_ORDER[a.kind] - KIND_ORDER[b.kind] : a.dueDate < b.dueDate ? -1 : 1,
  );
}

// ─── Idempotencia ───────────────────────────────────────────────────────────

export interface ExistingTask {
  readonly title: string;
  readonly due_date: string | null;
  readonly description: string | null;
}

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * true si la tarea ya existe: mismo marcador (mes + clave) o mismo título y fecha.
 * El título/fecha comparados son los que se van a guardar (pueden venir editados).
 */
export function isDuplicate(
  item: Pick<MonthPlanItem, "key" | "title" | "dueDate">,
  month: string,
  existing: readonly ExistingTask[],
): boolean {
  const title = normalizeTitle(item.title);
  return existing.some((t) => {
    const marker = readMarker(t.description);
    if (marker && marker.month === month && marker.key === item.key) return true;
    return t.due_date === item.dueDate && normalizeTitle(t.title) === title;
  });
}

export interface MonthSummary {
  /** Tareas del cliente con fecha en el mes. */
  readonly total: number;
  /** De esas (o con marcador del mes), cuántas vienen del plan del mes. */
  readonly fromPlan: number;
}

export function summarizeExisting(month: string, existing: readonly ExistingTask[]): MonthSummary {
  const { first, last } = monthBounds(month);
  const inMonth = existing.filter(
    (t) => (t.due_date !== null && t.due_date >= first && t.due_date <= last) || readMarker(t.description)?.month === month,
  );
  return { total: inMonth.length, fromPlan: inMonth.filter((t) => readMarker(t.description)?.month === month).length };
}
