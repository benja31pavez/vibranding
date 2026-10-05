import { useState } from "react";
import { ListChecks, Plus, Target } from "lucide-react";
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
import { taskColumn, type StageKey } from "@/lib/delivery/planStages";
import { MonthPlanDialogHost, MonthPlanMenu } from "./MonthPlanMenu";
import { ObjectivesColumn } from "./ObjectivesColumn";
import { StageTrack, TeamTrack } from "./StageTrack";
import { TaskBoard, TaskBoardSkeleton } from "./TaskBoard";
import { usePlanObjectives, type PlanTask } from "./planQueries";
import { usePlanBoard } from "./usePlanBoard";

type SheetKind = "objectives" | "objectives-new" | "stages" | null;

export interface PlanPageProps {
  clientId: string;
  stage: StageKey | null;
  onStageChange: (stage: StageKey | null) => void;
}

/**
 * Vista de gestión del plan del cliente, en una pantalla: etapas del plan
 * contratado arriba (con responsable, avance y fecha de entrega), objetivos a
 * la izquierda y tablero de tareas de la etapa elegida a la derecha.
 */
export function PlanPage({ clientId, stage, onStageChange }: PlanPageProps) {
  const userKey = useUserKey();
  const today = chileToday();
  const overview = useFichaOverview(clientId);
  const objectivesQ = usePlanObjectives(userKey, clientId);
  const canEdit = overview.data?.canEdit ?? false;
  const board = usePlanBoard({
    clientId,
    userKey,
    planKey: overview.data?.billing?.plan_key ?? null,
    stage,
    today,
  });
  const { plan, stages, activeStage, visibleTasks, tasksQ, stagesQ } = board;
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [focusAdd, setFocusAdd] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<PlanTask | null>(null);
  const [monthPlanMonth, setMonthPlanMonth] = useState<string | null>(null);

  const closeSheet = (open: boolean) => {
    if (open) return;
    setSheet(null);
    board.refresh();
  };

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
          actions={
            <>
              <MonthPlanMenu
                planKey={plan.planKey}
                planLabel={plan.label}
                canEdit={canEdit}
                today={today}
                onPick={setMonthPlanMonth}
              />
              <Button variant="outline" onClick={() => setSheet("objectives-new")}>
                <Target aria-hidden className="mr-1 h-4 w-4" /> Nuevo objetivo
              </Button>
              <Button onClick={() => setFocusAdd((n) => n + 1)} disabled={!canEdit}>
                <Plus aria-hidden className="mr-1 h-4 w-4" /> Nueva tarea
              </Button>
            </>
          }
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
          />
        ) : (
          <StageTrack stages={stages} selected={activeStage} onSelect={onStageChange} />
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
            onManage={() => setSheet("objectives")}
            onCreate={() => setSheet("objectives-new")}
          />
        </div>
        <div className="flex min-w-0 flex-col md:min-h-0">
          <Panel
            fill
            title={selected ? `Tareas · ${selected.label}` : "Tareas · Todas las etapas"}
            icon={ListChecks}
            description={
              tasksQ.data
                ? `${doneCount} de ${visibleTasks.length} listas${selected ? ` · ${selected.detail}` : ""}`
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
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSheet("stages")}
                >
                  Etapas y entregables
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
              />
            )}
          </Panel>
        </div>
      </div>

      <Sheet open={sheet === "objectives" || sheet === "objectives-new"} onOpenChange={closeSheet}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
          <SheetHeader className="border-b px-6 pb-3 pt-6 text-left">
            <SheetTitle>Objetivos</SheetTitle>
            <SheetDescription>Crea, edita y actualiza el avance de cada objetivo.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {sheet && (
              <ObjectivesList clientId={clientId} initialAdding={sheet === "objectives-new"} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sheet === "stages"} onOpenChange={closeSheet}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
          <SheetHeader className="border-b px-6 pb-3 pt-6 text-left">
            <SheetTitle>Etapas y entregables</SheetTitle>
            <SheetDescription>
              Fecha de entrega, estado, checklist, archivos y revisión del cliente de cada etapa.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {sheet === "stages" && <DeliverablesList clientId={clientId} />}
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

      {monthPlanMonth && (
        <MonthPlanDialogHost
          clientId={clientId}
          userKey={userKey}
          planKey={plan.planKey}
          planLabel={plan.label}
          month={monthPlanMonth}
          today={today}
          onClose={() => setMonthPlanMonth(null)}
          onCreated={board.refresh}
        />
      )}
    </FitPage>
  );
}
