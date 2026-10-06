/**
 * Ciclo mensual del plan: tareas que se repiten cada mes en los planes
 * mensuales (Contenido, Crecimiento y Mantención; Marca + Web no tiene ciclo).
 *
 * Fuente única. Para cambiar un título, el día, el responsable o la etapa,
 * edita solo `CYCLE_TASKS`. Las claves (`key`) son estables.
 *
 * Cada tarea creada lleva el marcador `[plantilla:<etapa>:<clave>:<AAAA-MM>]`
 * y se registra en `plan_template_seeds` como `ciclo:<clave>:<AAAA-MM>`: una
 * vez por cliente y mes (aunque cambie el plan o la etapa), y si alguien la
 * borra no vuelve.
 *
 * Fechas "AAAA-MM-DD" en hora de Chile: el día N del mes, o el siguiente día
 * hábil si cae en fin de semana o feriado (`CL_HOLIDAYS`).
 *
 * Módulo puro: sin Supabase ni reloj.
 */
import type { PlanKey } from "@/lib/pricing/plans";
import { CL_HOLIDAYS, isMonthKey, monthBounds, nextMonth } from "./monthPlan";
import { PIECES_PER_MONTH, type PlanSignal } from "./planChecklists";
import type { StageKey } from "./planStages";
import type { TeamMemberKey } from "./team";

export type CyclePlanKey = "contenido" | "crecimiento" | "mantencion";
export const CYCLE_PLANS: readonly CyclePlanKey[] = ["contenido", "crecimiento", "mantencion"];

export function isCyclePlan(planKey: PlanKey | string | null | undefined): planKey is CyclePlanKey {
  return (CYCLE_PLANS as readonly string[]).includes(planKey ?? "");
}

/** Desde este día del mes también se crea el ciclo del mes siguiente. */
export const NEXT_MONTH_FROM_DAY = 25;

/** Semana del mes en que se trabaja la tarea (para agrupar y documentar). */
export type CycleWeek = 1 | 2 | 3 | "cierre";

export interface CycleTask {
  /** Clave estable (minúsculas, números y guiones). */
  readonly key: string;
  /** `{mes}` se reemplaza por el nombre del mes ("octubre"). */
  readonly title: string;
  readonly titleByPlan?: Partial<Readonly<Record<CyclePlanKey, string>>>;
  readonly owner: TeamMemberKey;
  readonly week: CycleWeek;
  /** Día del mes (o del mes siguiente si `nextMonth`). Ignorado si `weekly`. */
  readonly day: number;
  /** El día es del mes siguiente (cierre: reporte, pago de pauta). */
  readonly nextMonth?: boolean;
  /** Una tarea por cada lunes del mes (claves `<key>-1`, `<key>-2`…). */
  readonly weekly?: boolean;
  /** Etapa en cada plan; un plan que no aparece no tiene esta tarea. */
  readonly stages: Partial<Readonly<Record<CyclePlanKey, StageKey>>>;
  /** Señal de la plataforma ("Detectado ✓ — revisar"). */
  readonly signal?: PlanSignal;
}

/** Tareas del ciclo mensual. Edita aquí. */
export const CYCLE_TASKS: readonly CycleTask[] = [
  // Semana 1
  {
    key: "calendario",
    title: "Calendario de {mes}",
    owner: "benjamin",
    week: 1,
    day: 3,
    stages: { contenido: "planificacion", crecimiento: "contenido", mantencion: "planificacion" },
  },
  {
    key: "copys",
    title: "Copys de {mes}",
    owner: "benjamin",
    week: 1,
    day: 5,
    stages: { contenido: "planificacion", crecimiento: "contenido" },
  },
  {
    key: "anuncios",
    title: "Anuncios nuevos de {mes}",
    owner: "antonia",
    week: 1,
    day: 8,
    stages: { crecimiento: "ads" },
  },
  // Semana 2
  {
    key: "piezas",
    title: `${PIECES_PER_MONTH.contenido} piezas de {mes} diseñadas`,
    titleByPlan: { mantencion: `${PIECES_PER_MONTH.mantencion} piezas de {mes} diseñadas` },
    owner: "antonia",
    week: 2,
    day: 10,
    stages: { contenido: "diseno", crecimiento: "contenido", mantencion: "diseno" },
  },
  {
    key: "envio-aprobacion",
    title: "Enviar piezas de {mes} a aprobación en el portal",
    owner: "benjamin",
    week: 2,
    day: 10,
    stages: { contenido: "planificacion", crecimiento: "contenido" },
  },
  {
    key: "revision-campanas",
    title: "Revisión semanal de campañas",
    owner: "benjamin",
    week: 2,
    day: 1,
    weekly: true,
    stages: { crecimiento: "ads" },
  },
  // Semana 3
  {
    key: "aprobacion",
    title: "Aprobación del cliente de {mes} (≤48 h)",
    owner: "benjamin",
    week: 3,
    day: 12,
    stages: { contenido: "planificacion", crecimiento: "contenido" },
  },
  {
    key: "programar",
    title: "Programar publicaciones de {mes}",
    owner: "benjamin",
    week: 3,
    day: 13,
    stages: { contenido: "planificacion", crecimiento: "contenido", mantencion: "planificacion" },
  },
  {
    key: "presupuesto",
    title: "Ajuste de presupuesto de {mes}",
    owner: "benjamin",
    week: 3,
    day: 15,
    stages: { crecimiento: "ads" },
  },
  // Cierre (mes siguiente)
  {
    key: "reporte",
    title: "Reporte de {mes}",
    owner: "benjamin",
    week: "cierre",
    day: 1,
    nextMonth: true,
    signal: "report_generated",
    stages: { contenido: "reporte", crecimiento: "reporte", mantencion: "planificacion" },
  },
  {
    key: "pago-pauta",
    title: "Pago de pauta de {mes} verificado",
    owner: "benjamin",
    week: "cierre",
    day: 1,
    nextMonth: true,
    signal: "ads_billing_verified",
    stages: { crecimiento: "ads" },
  },
  {
    key: "reporte-enviado",
    title: "Reporte de {mes} enviado + 15 min de revisión",
    owner: "benjamin",
    week: "cierre",
    day: 3,
    nextMonth: true,
    signal: "report_sent",
    stages: { contenido: "reporte", crecimiento: "reporte" },
  },
];

/** Señales que se leen del mes de la tarea (el reporte de ESE mes), no de "lo reciente". */
export const MONTH_SCOPED_SIGNALS: ReadonlySet<PlanSignal> = new Set([
  "report_generated",
  "report_sent",
]);

// ─── Fechas ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;
const DAY_MS = 86_400_000;
const SATURDAY = 6;
const SUNDAY = 0;
const MONDAY = 1;
/** Tope de días que se corre una fecha (evita un ciclo infinito con datos raros). */
const MAX_SHIFT_DAYS = 10;

/** "2026-10" → "octubre". */
export function monthName(month: string): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;
}

function utc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "AAAA-MM-DD" + n días de calendario. */
export function addDays(ymd: string, days: number): string {
  return toYmd(new Date(utc(ymd).getTime() + days * DAY_MS));
}

export function isBusinessDay(ymd: string): boolean {
  const weekday = utc(ymd).getUTCDay();
  return weekday !== SATURDAY && weekday !== SUNDAY && !CL_HOLIDAYS.has(ymd);
}

/** El mismo día si es hábil; si no, el siguiente día hábil. */
export function nextBusinessDay(ymd: string): string {
  let day = ymd;
  for (let i = 0; i < MAX_SHIFT_DAYS && !isBusinessDay(day); i++) day = addDays(day, 1);
  return day;
}

/** Día `day` del mes (acotado al último día), corrido al siguiente día hábil. */
export function cycleDate(month: string, day: number): string {
  const { last } = monthBounds(month);
  const lastDay = Number(last.slice(8, 10));
  const dd = String(Math.min(Math.max(day, 1), lastDay)).padStart(2, "0");
  return nextBusinessDay(`${month}-${dd}`);
}

/** Lunes del mes (cada uno corrido al siguiente día hábil si es feriado). */
export function mondaysOf(month: string): string[] {
  const { first, last } = monthBounds(month);
  const out: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    if (utc(d).getUTCDay() === MONDAY) out.push(nextBusinessDay(d));
  }
  return out;
}

/** Meses a crear hoy: el actual y, desde el día 25, también el siguiente. */
export function cycleMonths(today: string): string[] {
  const month = today.slice(0, 7);
  if (!isMonthKey(month)) return [];
  const day = Number(today.slice(8, 10));
  return day >= NEXT_MONTH_FROM_DAY ? [month, nextMonth(month)] : [month];
}

// ─── Tareas del mes ─────────────────────────────────────────────────────────

export interface PlannedCycleTask {
  /** "ciclo:<clave>:<AAAA-MM>" (registro en plan_template_seeds). */
  readonly itemKey: string;
  readonly month: string;
  readonly stage: StageKey;
  readonly key: string;
  readonly title: string;
  readonly owner: TeamMemberKey;
  readonly dueDate: string;
  readonly signal: PlanSignal | null;
}

export function cycleItemKey(key: string, month: string): string {
  return `ciclo:${key}:${month}`;
}

/** `[plantilla:planificacion:calendario:2026-10]`. */
export function cycleMarker(stage: StageKey, key: string, month: string): string {
  return `[plantilla:${stage}:${key}:${month}]`;
}

/** Nota visible + marcador, para la descripción de la tarea creada. */
export function cycleDescription(stage: StageKey, key: string, month: string): string {
  return `Tarea del ciclo mensual del plan.\n\n${cycleMarker(stage, key, month)}`;
}

/** Definición de una tarea del ciclo por su clave (las semanales: `revision-campanas-2`). */
export function findCycleTask(key: string): CycleTask | null {
  return (
    CYCLE_TASKS.find((t) => t.key === key) ??
    CYCLE_TASKS.find((t) => t.weekly && key.startsWith(`${t.key}-`)) ??
    null
  );
}

function expand(task: CycleTask, planKey: CyclePlanKey, month: string): PlannedCycleTask[] {
  const stage = task.stages[planKey];
  if (!stage) return [];
  const name = monthName(month);
  const title = (task.titleByPlan?.[planKey] ?? task.title).replace("{mes}", name);
  const base = { month, stage, owner: task.owner, signal: task.signal ?? null };
  if (task.weekly) {
    const mondays = mondaysOf(month);
    return mondays.map((dueDate, i) => {
      const key = `${task.key}-${i + 1}`;
      return {
        ...base,
        key,
        itemKey: cycleItemKey(key, month),
        title: `${title} (semana ${i + 1})`,
        dueDate,
      };
    });
  }
  const dueMonth = task.nextMonth ? nextMonth(month) : month;
  return [
    {
      ...base,
      key: task.key,
      itemKey: cycleItemKey(task.key, month),
      title,
      dueDate: cycleDate(dueMonth, task.day),
    },
  ];
}

/** Tareas del ciclo de un mes para el plan, ordenadas por fecha. Vacío sin ciclo. */
export function cycleForPlan(planKey: PlanKey | null, month: string): PlannedCycleTask[] {
  if (!isCyclePlan(planKey) || !isMonthKey(month)) return [];
  return CYCLE_TASKS.flatMap((t) => expand(t, planKey, month)).sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
}

// ─── Qué falta crear ────────────────────────────────────────────────────────

export interface CycleSeedInput {
  readonly planKey: PlanKey | null;
  /** Meses a revisar ("AAAA-MM"), normalmente `cycleMonths(hoy)`. */
  readonly months: readonly string[];
  /** Claves `ciclo:…` presentes en las tareas del cliente (por su marcador). */
  readonly present: ReadonlySet<string>;
  /** Claves ya registradas en `plan_template_seeds`. */
  readonly ledger: ReadonlySet<string>;
  /** Inicio del cliente ("AAAA-MM-DD"): no se crea nada con fecha anterior. */
  readonly clientStart: string | null;
}

export interface CycleSeedPlan {
  readonly tasks: readonly PlannedCycleTask[];
  /** Claves a registrar: las que se crean y las que ya existían sin registro. */
  readonly ledgerAdd: readonly string[];
}

/**
 * Lo que falta crear del ciclo. Idempotente por cliente + mes: una clave
 * presente o registrada no se vuelve a crear (tampoco si alguien la borró).
 */
export function cycleSeed({
  planKey,
  months,
  present,
  ledger,
  clientStart,
}: CycleSeedInput): CycleSeedPlan {
  const planned = [...new Set(months)].flatMap((m) => cycleForPlan(planKey, m));
  const tasks = planned.filter(
    (t) =>
      !present.has(t.itemKey) &&
      !ledger.has(t.itemKey) &&
      (!clientStart || t.dueDate >= clientStart),
  );
  const seen = planned.filter((t) => present.has(t.itemKey) && !ledger.has(t.itemKey));
  return { tasks, ledgerAdd: [...tasks, ...seen].map((t) => t.itemKey) };
}
