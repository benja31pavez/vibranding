import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListChecks, Plus } from "lucide-react";
import { ConfirmDialog, ErrorState, FitPage, PageHeader, Panel } from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useFichaOverview, useUserKey } from "@/components/clients/ficha/fichaQueries";
import { DeliverablesList } from "@/components/DeliverablesList";
import { ObjectivesList } from "@/components/ObjectivesList";
import { chileToday } from "@/lib/dates/chile";
import { cn } from "@/lib/utils";
import { taskColumn, toMonthPlanKey, type StageKey } from "@/lib/delivery/planStages";
import { objectivesForPlan } from "@/lib/delivery/planChecklists";
import { isTemplateObjective } from "@/lib/delivery/planTemplateSeed";
import { ObjectivesColumn } from "./ObjectivesColumn";
import { StageTrack, TeamTrack } from "./StageTrack";
import { TaskBoard, TaskBoardSkeleton } from "./TaskBoard";
import { invalidatePlan, usePlanObjectives, type PlanTask } from "./planQueries";
import { seedPlanTemplates, usePlanSignals } from "./planTemplates";
import type { StageMenuActions } from "./StageMenu";
import { usePlanBoard } from "./usePlanBoard";

/** Panel lateral abierto: un objetivo (por id), el formulario de nuevo objetivo o los entregables. */
type OpenSheet = { kind: "objective"; id: string } | { kind: "objectives-new" | "stages" };

export interface PlanPageProps {
  clientId: string;
  stage: StageKey | null;
  onStageChange: (stage: StageKey | null) => void;
}

/**
 * Vista de gestión del plan del cliente, en una pantalla: etapas del plan
 * contratado arriba (con responsable, avance y fecha de entrega), objetivos a
 * la izquierda y tablero de tareas de la etapa elegida a la derecha. Cada panel
 * lleva su propio botón de crear; un objetivo se edita con un clic y la fecha de
 * una etapa desde el "⋯" de su tarjeta.
 */
export function PlanPage({ clientId, stage, onStageChange }: PlanPageProps) {
  const userKey = useUserKey();
  const today = chileToday();
  const overview = useFichaOverview(clientId);
  const objectivesQ = usePlanObjectives(userKey, clientId);
  const canEdit = overview.data?.canEdit ?? false;
  const planKey = overview.data?.billing?.plan_key ?? null;
  const board = usePlanBoard({ clientId, userKey, planKey, stage, today });
  const signalsQ = usePlanSignals(userKey, clientId, today);
  const signals = useMemo(() => signalsQ.data ?? new Set<never>(), [signalsQ.data]);
  const standardObjectives = useMemo(() => objectivesForPlan(toMonthPlanKey(planKey)), [planKey]);
  usePlanTemplateSeed({ clientId, userKey, planKey, enabled: Boolean(overview.data) && canEdit });
  const { plan, stages, activeStage, visibleTasks, tasksQ, stagesQ } = board;
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  const [focusAdd, setFocusAdd] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<PlanTask | null>(null);

  const closeSheet = (open: boolean) => {
    if (open) return;
    setSheet(null);
    board.refresh();
  };

  const stageMenu: StageMenuActions = {
    canEdit,
    onSetDue: board.setStageDue,
    onOpenDeliverables: () => setSheet({ kind: "stages" }),
  };
  const objectiveSheet =
    sheet?.kind === "objective" || sheet?.kind === "objectives-new" ? sheet : null;

  const selected = activeStage ? stages.find((s) => s.key === activeStage) : null;
  const doneCount = visibleTasks.filter((t) => taskColumn(t.status) === "done").length;

  return (
    <FitPage
      header={
        <PageHeader
          size="compact"
          title="Plan"
          description={`${plan.label} · ${
            plan.planKey ? "etapas según el plan contratado" : "se muestran todas las etapas"
          }`}
        />
      }
      contentClassName="flex flex-col gap-3"
    >
      <div className="shrink-0">
        {stagesQ.error ? (
          <ErrorState
            title="No pudimos cargar las etapas"
            message={stagesQ.error.message}
            onRetry={() => void stagesQ.refetch()}
            retrying={stagesQ.isFetching}
          />
        ) : plan.view === "people" ? (
          <TeamTrack
            members={board.members}
            stages={stages}
            selected={activeStage}
            onSelect={onStageChange}
            menu={stageMenu}
          />
        ) : (
          <StageTrack
            stages={stages}
            selected={activeStage}
            onSelect={onStageChange}
            menu={stageMenu}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:min-h-0 md:flex-1 md:grid-cols-[minmax(230px,1fr)_minmax(0,2.6fr)] md:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col md:min-h-0">
          <ObjectivesColumn
            objectives={objectivesQ.data}
            loading={objectivesQ.isLoading}
            error={objectivesQ.error}
            onRetry={() => void objectivesQ.refetch()}
            today={today}
            onOpen={(id) => setSheet({ kind: "objective", id })}
            onCreate={() => setSheet({ kind: "objectives-new" })}
            isTemplate={(o) => isTemplateObjective(o, standardObjectives)}
            noPlanClientId={overview.data && !toMonthPlanKey(planKey) ? clientId : null}
          />
        </div>
        <div className="flex min-w-0 flex-col md:min-h-0">
          <Panel
            fill
            title={selected ? `Tareas · ${selected.label}` : "Tareas · Todas las etapas"}
            icon={ListChecks}
            description={
              tasksQ.data
                ? `${doneCount} de ${visibleTasks.length} entregadas${selected ? ` · ${selected.detail}` : ""}`
                : undefined
            }
            actions={
              <>
                {activeStage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => onStageChange(null)}
                  >
                    Ver todas
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setFocusAdd((n) => n + 1)}
                  disabled={!canEdit}
                >
                  <Plus aria-hidden className="mr-1 h-3.5 w-3.5" /> Nueva tarea
                </Button>
              </>
            }
            bodyClassName="pt-2"
          >
            {tasksQ.error ? (
              <ErrorState
                title="No pudimos cargar las tareas"
                message={tasksQ.error.message}
                onRetry={() => void tasksQ.refetch()}
                retrying={tasksQ.isFetching}
              />
            ) : tasksQ.isLoading ? (
              <TaskBoardSkeleton />
            ) : (
              <TaskBoard
                tasks={visibleTasks}
                planStages={plan.stages}
                stage={activeStage}
                today={today}
                canEdit={canEdit}
                stageEditable={board.stageEditable}
                canApprove={board.canApprove}
                focusAddSignal={focusAdd}
                onMove={board.moveTask}
                onCreate={board.createTask}
                onDelete={setPendingDelete}
                onChangeStage={board.changeStage}
                onDelivery={board.setDelivery}
                signals={signals}
              />
            )}
          </Panel>
        </div>
      </div>

      <Sheet open={objectiveSheet !== null} onOpenChange={closeSheet}>
        <SheetContent
          side="right"
          className={cn(
            "flex w-full flex-col gap-0 p-0",
            objectiveSheet?.kind === "objective" ? "sm:max-w-xl" : "sm:max-w-3xl",
          )}
        >
          <SheetHeader className="border-b px-6 pb-3 pt-6 text-left">
            <SheetTitle>
              {objectiveSheet?.kind === "objective" ? "Objetivo" : "Nuevo objetivo"}
            </SheetTitle>
            <SheetDescription>
              {objectiveSheet?.kind === "objective"
                ? "Edita el objetivo, actualiza su avance o elimínalo desde el menú ⋯."
                : "Crea un objetivo medible. Abajo están todos los objetivos del cliente."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {objectiveSheet && (
              <ObjectivesList
                key={objectiveSheet.kind === "objective" ? objectiveSheet.id : "new"}
                clientId={clientId}
                initialAdding={objectiveSheet.kind === "objectives-new"}
                focusId={objectiveSheet.kind === "objective" ? objectiveSheet.id : null}
                onDeleted={() => closeSheet(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sheet?.kind === "stages"} onOpenChange={closeSheet}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
          <SheetHeader className="border-b px-6 pb-3 pt-6 text-left">
            <SheetTitle>Etapas y entregables</SheetTitle>
            <SheetDescription>
              Fecha de entrega, estado, checklist, archivos y revisión del cliente de cada etapa.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {sheet?.kind === "stages" && <DeliverablesList clientId={clientId} />}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="¿Eliminar tarea?"
        description={
          pendingDelete ? `«${pendingDelete.title}» se eliminará. No se puede deshacer.` : undefined
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) void board.deleteTask(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </FitPage>
  );
}

/**
 * Al abrir el Plan crea (una vez por visita, cliente y plan) lo que falte:
 * tareas de inicio, ciclo del mes (y del siguiente desde el día 25) y
 * objetivos estándar. Idempotente; nunca borra ni edita nada.
 */
function usePlanTemplateSeed({
  clientId,
  userKey,
  planKey,
  enabled,
}: {
  clientId: string;
  userKey: string;
  planKey: string | null;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const done = useRef<string | null>(null);
  useEffect(() => {
    const id = `${clientId}:${planKey ?? ""}`;
    if (!enabled || !toMonthPlanKey(planKey) || done.current === id) return;
    done.current = id;
    seedPlanTemplates(clientId, planKey)
      .then(({ tasks, objectives }) => {
        if (tasks + objectives === 0) return;
        toast.info(
          `Se agregaron ${tasks} tareas y ${objectives} objetivos del plan. Revísalos y ajústalos al cliente.`,
        );
        void invalidatePlan(queryClient, userKey, clientId);
      })
      .catch((e: Error) => {
        done.current = null;
        toast.error(`No se pudieron crear las tareas estándar del plan: ${e.message}`);
      });
  }, [clientId, userKey, planKey, enabled, queryClient]);
}
