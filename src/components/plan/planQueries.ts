/**
 * Datos de la vista Plan: etapas (`deliverables`), tareas (`client_tasks`),
 * objetivos (`objectives`) y servicios contratados (`client_contracts`). Todo con
 * la sesión del usuario (RLS). Las escrituras de tareas toleran que la columna
 * `stage_key`, `delivered_at` y `approved_at` aún no existan (migración
 * 20261012001300_etapas_estandar.sql).
 */
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StageKey } from "@/lib/delivery/planStages";
import { invalidateAfterMonthPlan } from "@/components/clients/ficha/monthPlanQueries";
import { PERMISSION_DENIED_MSG, writeErrorMessage } from "@/components/clients/ficha/fichaQueries";

export type TaskStatus = "pending" | "in_progress" | "in_review" | "done";

export interface PlanTask {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  status: TaskStatus;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  /** Estas tres solo vienen si la migración de etapas está aplicada. */
  stage_key?: string | null;
  delivered_at?: string | null;
  approved_at?: string | null;
}

export interface PlanStageRow {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  sort_order: number;
  stage_key?: string | null;
}

export interface PlanObjective {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  priority: string;
  created_at: string;
}

/** Tope por consulta: un cliente normal tiene decenas de tareas; sobra margen. */
const ROW_LIMIT = 500;
/** PostgREST / Postgres cuando la columna no existe todavía. */
const MISSING_COLUMN_CODES = new Set(["PGRST204", "42703"]);

export const planKeys = {
  all: (userId: string, clientId: string) => ["plan", userId, clientId] as const,
  stages: (userId: string, clientId: string) => ["plan", userId, clientId, "stages"] as const,
  tasks: (userId: string, clientId: string) => ["plan", userId, clientId, "tasks"] as const,
  objectives: (userId: string, clientId: string) =>
    ["plan", userId, clientId, "objectives"] as const,
  contracted: (userId: string, clientId: string) =>
    ["plan", userId, clientId, "contracted"] as const,
};

function fail(error: { code?: string; message: string }): never {
  throw new Error(writeErrorMessage(error));
}

export function usePlanStages(userKey: string, clientId: string) {
  return useQuery({
    queryKey: planKeys.stages(userKey, clientId),
    queryFn: async (): Promise<PlanStageRow[]> => {
      const { data, error } = await supabase
        .from("deliverables")
        .select("*")
        .eq("client_id", clientId)
        .order("sort_order")
        .limit(ROW_LIMIT);
      if (error) fail(error);
      return (data ?? []) as PlanStageRow[];
    },
  });
}

export function usePlanTasks(userKey: string, clientId: string) {
  return useQuery({
    queryKey: planKeys.tasks(userKey, clientId),
    queryFn: async (): Promise<PlanTask[]> => {
      const { data, error } = await supabase
        .from("client_tasks")
        .select("*")
        .eq("client_id", clientId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(ROW_LIMIT);
      if (error) fail(error);
      return (data ?? []) as PlanTask[];
    },
  });
}

export function usePlanObjectives(userKey: string, clientId: string) {
  return useQuery({
    queryKey: planKeys.objectives(userKey, clientId),
    queryFn: async (): Promise<PlanObjective[]> => {
      const { data, error } = await supabase
        .from("objectives")
        .select("id,title,status,due_date,target_value,current_value,unit,priority,created_at")
        .eq("client_id", clientId)
        .order("sort_order")
        .order("created_at")
        .limit(ROW_LIMIT);
      if (error) fail(error);
      return (data ?? []) as PlanObjective[];
    },
  });
}

/** `service_key` de los contratos firmados (planes y servicios adicionales). */
export function usePlanContracted(userKey: string, clientId: string) {
  return useQuery({
    queryKey: planKeys.contracted(userKey, clientId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("client_contracts")
        .select("services_snapshot")
        .eq("client_id", clientId)
        .eq("status", "signed")
        .limit(50);
      if (error) fail(error);
      return (data ?? []).flatMap((row) => serviceKeys(row.services_snapshot));
    },
  });
}

function serviceKeys(snapshot: unknown): string[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.flatMap((line) =>
    line &&
    typeof line === "object" &&
    typeof (line as { service_key?: unknown }).service_key === "string"
      ? [(line as { service_key: string }).service_key]
      : [],
  );
}

/** `true` si alguna fila trae la columna (migración aplicada). Sin filas no se sabe: false. */
export function hasTaskColumn(
  tasks: readonly PlanTask[],
  column: "stage_key" | "delivered_at" | "approved_at",
): boolean {
  return tasks.some((t) => Object.prototype.hasOwnProperty.call(t, column));
}

// ─── Escrituras ─────────────────────────────────────────────────────────────

export interface NewTaskInput {
  title: string;
  status: TaskStatus;
  stageKey: StageKey | null;
  dueDate: string | null;
}

export interface CreateTaskResult {
  /** false si la etapa no se pudo guardar porque la migración no está aplicada. */
  stageSaved: boolean;
}

/** Crea una tarea. Si la columna `stage_key` aún no existe, la crea sin etapa. */
export async function createPlanTask(
  clientId: string,
  input: NewTaskInput,
): Promise<CreateTaskResult> {
  const base = {
    client_id: clientId,
    title: input.title.trim(),
    status: input.status,
    due_date: input.dueDate,
  };
  if (input.stageKey) {
    const withStage = await supabase
      .from("client_tasks")
      .insert({ ...base, stage_key: input.stageKey } as typeof base)
      .select("id");
    if (!withStage.error && withStage.data?.length) return { stageSaved: true };
    if (withStage.error && !MISSING_COLUMN_CODES.has(withStage.error.code ?? "")) {
      fail(withStage.error);
    }
    if (!withStage.error) throw new Error(PERMISSION_DENIED_MSG);
  }
  const res = await supabase.from("client_tasks").insert(base).select("id");
  if (res.error) fail(res.error);
  if (!res.data || res.data.length === 0) throw new Error(PERMISSION_DENIED_MSG);
  return { stageSaved: !input.stageKey };
}

export type PlanTaskPatch = Partial<
  Pick<PlanTask, "status" | "title" | "due_date" | "stage_key" | "delivered_at" | "approved_at">
>;

export async function updatePlanTask(id: string, patch: PlanTaskPatch): Promise<void> {
  const res = await supabase
    .from("client_tasks")
    .update(patch as { status?: TaskStatus })
    .eq("id", id)
    .select("id");
  if (res.error) fail(res.error);
  if (!res.data || res.data.length === 0) throw new Error(PERMISSION_DENIED_MSG);
}

export async function deletePlanTask(id: string): Promise<void> {
  const res = await supabase.from("client_tasks").delete().eq("id", id).select("id");
  if (res.error) fail(res.error);
  if (!res.data || res.data.length === 0) throw new Error(PERMISSION_DENIED_MSG);
}

export interface StageDueTarget {
  key: StageKey;
  label: string;
  /** Fila de `deliverables` de la etapa; sin fila se crea una con el nombre de la etapa. */
  rowId: string | null;
}

/**
 * Guarda la fecha de entrega de una etapa (`deliverables.due_date`). Si la etapa
 * aún no tiene fila, la crea con el nombre de la etapa (y `stage_key` si la
 * migración está aplicada), igual que se crearía desde la lista de entregables.
 */
export async function setStageDueDate(
  clientId: string,
  stage: StageDueTarget,
  dueDate: string | null,
): Promise<void> {
  if (stage.rowId) {
    const res = await supabase
      .from("deliverables")
      .update({ due_date: dueDate })
      .eq("id", stage.rowId)
      .select("id");
    if (res.error) fail(res.error);
    if (!res.data || res.data.length === 0) throw new Error(PERMISSION_DENIED_MSG);
    return;
  }
  const base = { client_id: clientId, title: stage.label, due_date: dueDate };
  const withKey = await supabase
    .from("deliverables")
    .insert({ ...base, stage_key: stage.key } as typeof base)
    .select("id");
  if (!withKey.error && withKey.data?.length) return;
  if (withKey.error && !MISSING_COLUMN_CODES.has(withKey.error.code ?? "")) fail(withKey.error);
  if (!withKey.error) throw new Error(PERMISSION_DENIED_MSG);
  const res = await supabase.from("deliverables").insert(base).select("id");
  if (res.error) fail(res.error);
  if (!res.data || res.data.length === 0) throw new Error(PERMISSION_DENIED_MSG);
}

/** Refresca el Plan y todo lo que muestra tareas (Agenda, Hoy, ficha, aprobaciones). */
export function invalidatePlan(queryClient: QueryClient, userKey: string, clientId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: planKeys.all(userKey, clientId) }),
    invalidateAfterMonthPlan(queryClient, userKey, clientId),
  ]);
}
