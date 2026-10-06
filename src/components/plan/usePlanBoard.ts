import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  COLUMN_STATUS,
  isTaskLate,
  resolvePlan,
  summarizeByOwner,
  summarizeStages,
  taskColumn,
  taskStageKey,
  type StageKey,
  type TaskState,
} from "@/lib/delivery/planStages";
import { isRetiredTask } from "@/lib/delivery/planTemplateSeed";
import type { DeliveryAction } from "./TaskBoard";
import {
  createPlanTask,
  deletePlanTask,
  hasTaskColumn,
  invalidatePlan,
  planKeys,
  setStageDueDate,
  updatePlanTask,
  usePlanContracted,
  usePlanStages,
  usePlanTasks,
  type PlanTask,
  type PlanTaskPatch,
  type StageDueTarget,
} from "./planQueries";

export interface UsePlanBoardInput {
  clientId: string;
  userKey: string;
  planKey: string | null;
  stage: StageKey | null;
  today: string;
}

/** Datos y acciones del Plan: etapas del plan contratado, tareas filtradas y escrituras. */
export function usePlanBoard({ clientId, userKey, planKey, stage, today }: UsePlanBoardInput) {
  const queryClient = useQueryClient();
  const stagesQ = usePlanStages(userKey, clientId);
  const tasksQ = usePlanTasks(userKey, clientId);
  const contractedQ = usePlanContracted(userKey, clientId);

  // Las tareas de la plantilla anterior que reemplazó el ciclo mensual no se muestran (siguen en la BD).
  const tasks = useMemo(() => (tasksQ.data ?? []).filter((t) => !isRetiredTask(t)), [tasksQ.data]);
  const rows = useMemo(() => stagesQ.data ?? [], [stagesQ.data]);
  const plan = useMemo(
    () => resolvePlan(planKey, contractedQ.data ?? []),
    [planKey, contractedQ.data],
  );
  const stageKeys = useMemo(() => plan.stages.map((s) => s.key), [plan]);
  const stages = useMemo(
    () => summarizeStages({ plan, rows, tasks, today }),
    [plan, rows, tasks, today],
  );
  const members = useMemo(() => summarizeByOwner(stages), [stages]);
  // Una etapa que no es del plan del cliente (enlace viejo) se ignora.
  const activeStage = stage && stageKeys.includes(stage) ? stage : null;
  const visibleTasks = useMemo(
    () => (activeStage ? tasks.filter((t) => taskStageKey(t, stageKeys) === activeStage) : tasks),
    [tasks, activeStage, stageKeys],
  );

  const refresh = () => void invalidatePlan(queryClient, userKey, clientId);
  const tasksKey = planKeys.tasks(userKey, clientId);
  const deliveryColumns = hasTaskColumn(tasks, "delivered_at");

  /** Cambio optimista: se ve al instante y se revierte si la escritura falla. */
  const patchTask = async (task: PlanTask, patch: PlanTaskPatch, errorLabel: string) => {
    const previous = queryClient.getQueryData<PlanTask[]>(tasksKey);
    queryClient.setQueryData<PlanTask[]>(tasksKey, (list) =>
      (list ?? []).map((t) => (t.id === task.id ? { ...t, ...patch } : t)),
    );
    try {
      await updatePlanTask(task.id, patch);
      refresh();
    } catch (e) {
      queryClient.setQueryData(tasksKey, previous);
      toast.error(`${errorLabel}: ${(e as Error).message}`);
    }
  };

  /** Cambia el estado real (Pendiente / En proceso / Entregado). "Atrasado" no se guarda: se deriva. */
  const moveTask = (task: PlanTask, state: TaskState) => {
    if (taskColumn(task.status) === state) return;
    const patch = statePatch(task, state, deliveryColumns, new Date().toISOString());
    if (isTaskLate({ ...task, ...patch }, today)) {
      toast.info("Sigue en Atrasado: su fecha ya pasó.");
    }
    void patchTask(task, patch, "No se pudo cambiar el estado");
  };

  const setDelivery = (task: PlanTask, action: DeliveryAction) =>
    void patchTask(
      task,
      deliveryPatch(task, action, new Date().toISOString()),
      "No se pudo actualizar la entrega",
    );

  const changeStage = (task: PlanTask, next: StageKey | null) =>
    void patchTask(task, { stage_key: next }, "No se pudo cambiar la etapa");

  const createTask = async (title: string): Promise<boolean> => {
    try {
      const res = await createPlanTask(clientId, {
        title,
        status: "pending",
        stageKey: activeStage,
        dueDate: null,
      });
      const label = plan.stages.find((s) => s.key === activeStage)?.label;
      if (!res.stageSaved && label) {
        toast.info(
          `Tarea creada. La etapa ${label} se podrá guardar cuando se active la clasificación por etapas.`,
        );
      }
      refresh();
      return true;
    } catch (e) {
      toast.error(`No se pudo crear la tarea: ${(e as Error).message}`);
      return false;
    }
  };

  const setStageDue = async (stage: StageDueTarget, dueDate: string | null): Promise<boolean> => {
    try {
      await setStageDueDate(clientId, stage, dueDate);
      toast.success(dueDate ? `Entrega de ${stage.label} actualizada` : "Fecha de entrega quitada");
      refresh();
      return true;
    } catch (e) {
      toast.error(`No se pudo guardar la fecha: ${(e as Error).message}`);
      return false;
    }
  };

  const deleteTask = async (task: PlanTask) => {
    try {
      await deletePlanTask(task.id);
      toast.success("Tarea eliminada");
      refresh();
    } catch (e) {
      toast.error(`No se pudo eliminar la tarea: ${(e as Error).message}`);
    }
  };

  return {
    stagesQ,
    tasksQ,
    plan,
    stages,
    members,
    activeStage,
    tasks,
    visibleTasks,
    stageEditable: hasTaskColumn(tasks, "stage_key"),
    canApprove: hasTaskColumn(tasks, "approved_at"),
    refresh,
    moveTask,
    setDelivery,
    changeStage,
    createTask,
    deleteTask,
    setStageDue,
  };
}

/**
 * Qué se guarda al cambiar el estado. Entregado anota la fecha de entrega
 * (`delivered_at`, si la columna existe); volver a Pendiente o En proceso la
 * quita junto con la aprobación.
 */
function statePatch(
  task: PlanTask,
  state: TaskState,
  hasColumns: boolean,
  now: string,
): PlanTaskPatch {
  const status = COLUMN_STATUS[state];
  if (!hasColumns) return { status };
  if (state === "done") return { status, delivered_at: task.delivered_at ?? now };
  return { status, delivered_at: null, approved_at: null };
}

/** Aprobación del cliente (requiere la columna `approved_at`). Aprobar también la deja entregada. */
function deliveryPatch(task: PlanTask, action: DeliveryAction, now: string): PlanTaskPatch {
  if (action === "approve") {
    return { status: "done", delivered_at: task.delivered_at ?? now, approved_at: now };
  }
  return { approved_at: null };
}
