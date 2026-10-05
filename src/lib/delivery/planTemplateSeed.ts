/**
 * Qué tareas y objetivos estándar faltan crear para un cliente (lógica pura).
 *
 * Reglas:
 * - Idempotente: una tarea estándar se reconoce por su marcador
 *   `[plantilla:<etapa>:<clave>]`; un objetivo, por `template_key` o por el
 *   mismo título. Lo que ya existe no se vuelve a crear.
 * - Nunca se borra ni se edita nada: si el plan cambia se agregan las que
 *   falten; las tareas de etapas que el plan ya no tiene se dejan como están
 *   (siguen visibles en "Todas las etapas" y el historial no se pierde).
 * - Lo que alguien borró no vuelve: el registro `plan_template_seeds` guarda
 *   cada clave creada o vista. Sin ese registro (migración sin aplicar) se usa
 *   una regla de respaldo por grupo: si una etapa ya tiene alguna tarea
 *   estándar, no se le agregan más (así un borrado no "revive").
 */
import { normalizeText, isStageKey } from "./planStages";
import {
  checklistForPlan,
  objectivesForPlan,
  readTemplateMarker,
  taskItemKey,
  type ChecklistContext,
  type PlannedObjective,
  type PlannedTask,
} from "./planChecklists";

export interface SeedTaskLike {
  readonly description: string | null;
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
}

export interface SeedPlan {
  readonly tasks: readonly PlannedTask[];
  readonly objectives: readonly PlannedObjective[];
  /** Claves a registrar: las que se crean y las que ya existían sin registro. */
  readonly ledgerAdd: readonly string[];
}

/** "tarea:branding:logo" → "tarea:branding". */
export function itemGroup(itemKey: string): string {
  return itemKey.slice(0, itemKey.lastIndexOf(":"));
}

/** Claves de tareas estándar presentes (por su marcador). */
export function presentTaskKeys(tasks: readonly SeedTaskLike[]): Set<string> {
  return new Set(
    tasks.flatMap((t) => {
      const m = readTemplateMarker(t.description);
      return m && isStageKey(m.stage) ? [taskItemKey(m.stage, m.key)] : [];
    }),
  );
}

/** Claves de objetivos estándar presentes (por `template_key` o por el título). */
export function presentObjectiveKeys(
  objectives: readonly SeedObjectiveLike[],
  planned: readonly PlannedObjective[],
): Set<string> {
  const titles = new Set(objectives.map((o) => normalizeText(o.title)));
  const byKey = objectives.flatMap((o) => (o.template_key ? [o.template_key] : []));
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

/** Lo que falta crear y registrar para el cliente. */
export function planSeed({ ctx, tasks, objectives, ledger }: SeedInput): SeedPlan {
  const plannedTasks = checklistForPlan(ctx);
  const plannedObjectives = objectivesForPlan(ctx.planKey);
  const presentTasks = presentTaskKeys(tasks);
  const presentObjectives = presentObjectiveKeys(objectives, plannedObjectives);

  const newTasks = plannedTasks.filter((t) => shouldCreate(t.itemKey, presentTasks, ledger));
  const newObjectives = plannedObjectives.filter((o) =>
    shouldCreate(o.itemKey, presentObjectives, ledger),
  );
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
    ]),
  ].filter((k) => !ledger.has(k));
  return { tasks: newTasks, objectives: newObjectives, ledgerAdd };
}

/** ¿La tarea es estándar del plan? */
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
