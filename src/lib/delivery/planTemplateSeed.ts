/**
 * Qué tareas y objetivos estándar faltan crear para un cliente (lógica pura).
 *
 * Tres partes:
 * - Tareas de INICIO (`STAGE_CHECKLISTS`): una sola vez, al asignar el plan,
 *   con fecha relativa al día de inicio del cliente. A un cliente que ya tenía
 *   tareas de plantilla y empezó hace más de `ONBOARDING_WINDOW_DAYS` no se le
 *   agregan tareas de inicio nuevas (ya pasó su inicio).
 * - Tareas del CICLO mensual (`./planCycle`): las del mes actual y, desde el
 *   día 25, las del siguiente. Solo clientes activos con plan mensual.
 * - OBJETIVOS estándar del plan.
 *
 * Reglas:
 * - Idempotente: una tarea estándar se reconoce por su marcador
 *   (`[plantilla:<etapa>:<clave>]` o `[plantilla:<etapa>:<clave>:<AAAA-MM>]`);
 *   un objetivo, por `template_key` (o una clave anterior) o por el mismo título.
 * - Nunca se borra ni se edita nada: si el plan cambia se agregan las que
 *   falten; las tareas de etapas que el plan ya no tiene se dejan como están.
 * - Lo que alguien borró no vuelve: el registro `plan_template_seeds` guarda
 *   cada clave creada o vista. Sin ese registro (migración sin aplicar) se usa
 *   una regla de respaldo por grupo: si una etapa ya tiene alguna tarea
 *   estándar, no se le agregan más (así un borrado no "revive").
 */
import { normalizeText, isStageKey, type StageKey } from "./planStages";
import {
  checklistForPlan,
  objectivesForPlan,
  readTemplateMarker,
  taskItemKey,
  templateDescription,
  type ChecklistContext,
  type PlannedObjective,
  type PlannedTask,
} from "./planChecklists";
import {
  addDays,
  cycleDescription,
  cycleItemKey,
  cycleMonths,
  cycleSeed,
  findCycleTask,
  nextBusinessDay,
} from "./planCycle";
import type { TeamMemberKey } from "./team";

/** Días desde el inicio del cliente en que todavía se agregan tareas de inicio nuevas. */
export const ONBOARDING_WINDOW_DAYS = 30;

export interface SeedTaskLike {
  readonly description: string | null;
  /** Para reemplazar tareas de la plantilla anterior (ver `legacyToRetire`). */
  readonly id?: string;
  readonly status?: string;
}

export interface SeedObjectiveLike {
  readonly title: string;
  /** Solo existe con la migración 20261012001800_plan_plantillas.sql. */
  readonly template_key?: string | null;
}

export interface SeedInput {
  readonly ctx: ChecklistContext;
  readonly tasks: readonly SeedTaskLike[];
  readonly objectives: readonly SeedObjectiveLike[];
  /** Claves ya registradas en `plan_template_seeds` (vacío si no existe). */
  readonly ledger: ReadonlySet<string>;
  /** Hoy en Chile ("AAAA-MM-DD"). */
  readonly today: string;
  /** Inicio del cliente ("AAAA-MM-DD": `started_at` o la fecha de creación). */
  readonly clientStart: string | null;
  /** Cliente activo: solo entonces se crea el ciclo mensual. */
  readonly cycleActive: boolean;
}

/** Tarea lista para insertar. */
export interface SeedTask {
  readonly itemKey: string;
  readonly stage: StageKey;
  readonly key: string;
  readonly title: string;
  readonly owner: TeamMemberKey;
  readonly dueDate: string | null;
  readonly description: string;
}

/** Tarea de la plantilla anterior que se marca como reemplazada (nueva descripción). */
export interface RetireTask {
  readonly id: string;
  readonly description: string;
}

export interface SeedPlan {
  readonly tasks: readonly SeedTask[];
  readonly objectives: readonly PlannedObjective[];
  /** Claves a registrar: las que se crean y las que ya existían sin registro. */
  readonly ledgerAdd: readonly string[];
  /** Tareas viejas sin mes que ahora cubre el ciclo (se les cambia el marcador). */
  readonly retire: readonly RetireTask[];
}

// ─── Plantilla anterior reemplazada por el ciclo ────────────────────────────

/**
 * Tareas de la plantilla anterior (sin fecha ni mes, `<etapa>:<clave>`) que
 * ahora son tareas del ciclo mensual (clave del ciclo).
 */
export const LEGACY_CYCLE_KEYS: Readonly<Record<string, string>> = {
  "planificacion:calendario": "calendario",
  "contenido:calendario": "calendario",
  "planificacion:copys": "copys",
  "contenido:copys": "copys",
  "diseno:piezas": "piezas",
  "contenido:piezas": "piezas",
  "planificacion:aprobacion": "aprobacion",
  "contenido:aprobacion": "aprobacion",
  "planificacion:reporte": "reporte",
  "reporte:generado": "reporte",
  "reporte:enviado": "reporte-enviado",
  "optimizacion:revision-semanal": "revision-campanas",
};

/** Marcador de una tarea vieja ya reemplazada por el ciclo (no cuenta como plantilla). */
export const RETIRED_MARKER = "[plantilla-antigua:";

/** ¿Tarea vieja reemplazada por el ciclo? (se oculta en el Plan; la fila no se borra). */
export function isRetiredTask(task: { readonly description?: string | null }): boolean {
  return (task.description ?? "").includes(RETIRED_MARKER);
}

const isOpen = (status: string | undefined) => status !== "done" && status !== "in_review";

/**
 * Tareas viejas abiertas cuyo equivalente del ciclo ya existe (o se crea
 * ahora). `cycleItemKeys`: claves `ciclo:<clave>:<AAAA-MM>`. Las listas no se tocan.
 */
export function legacyToRetire(
  tasks: readonly SeedTaskLike[],
  cycleItemKeys: Iterable<string>,
): RetireTask[] {
  const covered = new Set(
    [...cycleItemKeys].flatMap((k) => {
      const def = findCycleTask(k.split(":")[1] ?? "");
      return def ? [def.key] : [];
    }),
  );
  return tasks.flatMap((t) => {
    const m = readTemplateMarker(t.description);
    if (!t.id || !m || m.month || !isOpen(t.status)) return [];
    const cycleKey = LEGACY_CYCLE_KEYS[`${m.stage}:${m.key}`];
    if (!cycleKey || !covered.has(cycleKey)) return [];
    const description = (t.description ?? "").replace("[plantilla:", RETIRED_MARKER);
    return [{ id: t.id, description }];
  });
}

/** "tarea:branding:logo" → "tarea:branding". */
export function itemGroup(itemKey: string): string {
  return itemKey.slice(0, itemKey.lastIndexOf(":"));
}

/** Claves de tareas de inicio presentes (por su marcador, sin mes). */
export function presentTaskKeys(tasks: readonly SeedTaskLike[]): Set<string> {
  return new Set(
    tasks.flatMap((t) => {
      const m = readTemplateMarker(t.description);
      return m && !m.month && isStageKey(m.stage) ? [taskItemKey(m.stage, m.key)] : [];
    }),
  );
}

/** Claves `ciclo:<clave>:<AAAA-MM>` presentes (por su marcador con mes; la etapa no importa). */
export function presentCycleKeys(tasks: readonly SeedTaskLike[]): Set<string> {
  return new Set(
    tasks.flatMap((t) => {
      const m = readTemplateMarker(t.description);
      return m?.month ? [cycleItemKey(m.key, m.month)] : [];
    }),
  );
}

/** Clave anterior de un objetivo → clave actual. */
function objectiveAliases(planned: readonly PlannedObjective[]): Map<string, string> {
  return new Map(planned.flatMap((p) => p.legacyItemKeys.map((k) => [k, p.itemKey] as const)));
}

/** Claves de objetivos estándar presentes (por `template_key`, clave anterior o título). */
export function presentObjectiveKeys(
  objectives: readonly SeedObjectiveLike[],
  planned: readonly PlannedObjective[],
): Set<string> {
  const aliases = objectiveAliases(planned);
  const titles = new Set(objectives.map((o) => normalizeText(o.title)));
  const byKey = objectives.flatMap((o) =>
    o.template_key ? [aliases.get(o.template_key) ?? o.template_key] : [],
  );
  const byTitle = planned.filter((p) => titles.has(normalizeText(p.title))).map((p) => p.itemKey);
  return new Set([...byKey, ...byTitle]);
}

/** ¿Hay que crear esta clave? */
function shouldCreate(
  itemKey: string,
  present: ReadonlySet<string>,
  ledger: ReadonlySet<string>,
): boolean {
  if (present.has(itemKey) || ledger.has(itemKey)) return false;
  const group = itemGroup(itemKey);
  const inGroup = (keys: ReadonlySet<string>) => [...keys].some((k) => itemGroup(k) === group);
  // Grupo ya sembrado antes de tener registro: no revivir lo que se borró.
  return !(inGroup(present) && !inGroup(ledger));
}

/** ¿El inicio del cliente es reciente (o futuro)? */
function isRecentStart(clientStart: string | null, today: string): clientStart is string {
  return Boolean(clientStart && clientStart >= addDays(today, -ONBOARDING_WINDOW_DAYS));
}

/**
 * Día base de las tareas de inicio: el inicio del cliente si es reciente (o
 * futuro); si no, hoy (el plan se asigna ahora).
 */
export function onboardingBase(clientStart: string | null, today: string): string {
  return isRecentStart(clientStart, today) ? clientStart : today;
}

/** Fecha de una tarea de inicio: día 1 = base; corrida al siguiente día hábil. */
export function onboardingDueDate(base: string, day: number | null): string | null {
  return day === null ? null : nextBusinessDay(addDays(base, Math.max(day, 1) - 1));
}

/** ¿Se pueden agregar tareas de inicio? Primera vez o inicio reciente. */
function onboardingOpen(
  present: ReadonlySet<string>,
  ledger: ReadonlySet<string>,
  clientStart: string | null,
  today: string,
): boolean {
  const hasPrior = present.size > 0 || [...ledger].some((k) => k.startsWith("tarea:"));
  return !hasPrior || isRecentStart(clientStart, today);
}

function onboardingTask(t: PlannedTask, base: string): SeedTask {
  return {
    itemKey: t.itemKey,
    stage: t.stage,
    key: t.key,
    title: t.title,
    owner: t.owner,
    dueDate: onboardingDueDate(base, t.day),
    description: templateDescription(t.stage, t.key),
  };
}

/** Tareas del ciclo mensual que faltan (solo clientes activos con plan mensual). */
function cyclePart(input: SeedInput) {
  if (!input.cycleActive) {
    return { tasks: [] as SeedTask[], ledgerAdd: [] as string[], retire: [] as RetireTask[] };
  }
  const present = presentCycleKeys(input.tasks);
  const plan = cycleSeed({
    planKey: input.ctx.planKey,
    months: cycleMonths(input.today),
    present,
    ledger: input.ledger,
    clientStart: input.clientStart,
  });
  const tasks = plan.tasks.map(
    (t): SeedTask => ({
      itemKey: t.itemKey,
      stage: t.stage,
      key: t.key,
      title: t.title,
      owner: t.owner,
      dueDate: t.dueDate,
      description: cycleDescription(t.stage, t.key, t.month),
    }),
  );
  const retire = legacyToRetire(input.tasks, [...present, ...plan.tasks.map((t) => t.itemKey)]);
  return { tasks, ledgerAdd: [...plan.ledgerAdd], retire };
}

/** Lo que falta crear y registrar para el cliente. */
export function planSeed(input: SeedInput): SeedPlan {
  const { ctx, tasks, objectives, ledger, today, clientStart } = input;
  const plannedTasks = checklistForPlan(ctx);
  const plannedObjectives = objectivesForPlan(ctx.planKey);
  const presentTasks = presentTaskKeys(tasks);
  const presentObjectives = presentObjectiveKeys(objectives, plannedObjectives);
  const aliases = objectiveAliases(plannedObjectives);
  const objectiveLedger = new Set([...ledger].map((k) => aliases.get(k) ?? k));

  const base = onboardingBase(clientStart, today);
  const newTasks = onboardingOpen(presentTasks, ledger, clientStart, today)
    ? plannedTasks
        .filter((t) => shouldCreate(t.itemKey, presentTasks, ledger))
        .map((t) => onboardingTask(t, base))
    : [];
  const newObjectives = plannedObjectives.filter((o) =>
    shouldCreate(o.itemKey, presentObjectives, objectiveLedger),
  );
  const cycle = cyclePart(input);

  const plannedKeys = new Set([
    ...plannedTasks.map((t) => t.itemKey),
    ...plannedObjectives.map((o) => o.itemKey),
  ]);
  const seen = [...presentTasks, ...presentObjectives].filter((k) => plannedKeys.has(k));
  const ledgerAdd = [
    ...new Set([
      ...newTasks.map((t) => t.itemKey),
      ...newObjectives.map((o) => o.itemKey),
      ...seen,
      ...cycle.ledgerAdd,
    ]),
  ].filter((k) => !ledger.has(k));
  return {
    tasks: [...newTasks, ...cycle.tasks],
    objectives: newObjectives,
    ledgerAdd,
    retire: cycle.retire,
  };
}

/** ¿La tarea es estándar del plan (de inicio o del ciclo)? */
export function isTemplateTask(task: SeedTaskLike): boolean {
  return readTemplateMarker(task.description) !== null;
}

/** ¿El objetivo es estándar del plan del cliente? */
export function isTemplateObjective(
  objective: SeedObjectiveLike,
  planned: readonly PlannedObjective[],
): boolean {
  if (objective.template_key) return true;
  const title = normalizeText(objective.title);
  return planned.some((p) => normalizeText(p.title) === title);
}

/** Clave con el formato anterior a la migración del ciclo (`tarea:` / `objetivo:`). */
export function isLegacyLedgerKey(itemKey: string): boolean {
  return itemKey.startsWith("tarea:") || itemKey.startsWith("objetivo:");
}
