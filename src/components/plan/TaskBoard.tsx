import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Calendar,
  Check,
  CheckCheck,
  GripVertical,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  User,
} from "lucide-react";
import { FitList } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  BOARD_COLUMNS,
  BOARD_COLUMN_LABELS,
  DELIVERY_LABELS,
  deliveryState,
  taskColumn,
  taskStageKey,
  type BoardColumn,
  type DeliveryState,
  type PlanStage,
  type StageKey,
} from "@/lib/delivery/planStages";
import { SIGNAL_LABELS, type PlanSignal } from "@/lib/delivery/planChecklists";
import { detectedSignal, type SignalSet } from "@/lib/delivery/planSignals";
import { isTemplateTask } from "@/lib/delivery/planTemplateSeed";
import { teamMemberByName } from "@/lib/delivery/team";
import type { PlanTask } from "./planQueries";
import { formatShortDate } from "./planFormat";
import { TeamAvatar } from "./TrackItem";

const TITLE_MAX = 200;

const COLUMN_DOT: Readonly<Record<BoardColumn, string>> = {
  todo: "bg-muted-foreground/50",
  doing: "bg-warning",
  done: "bg-success",
};

export type DeliveryAction = "deliver" | "approve" | "undo";

export interface TaskBoardProps {
  tasks: readonly PlanTask[];
  /** Etapas del plan del cliente (para etiquetas y para cambiar la etapa). */
  planStages: readonly PlanStage[];
  /** Etapa filtrada (null = todas). */
  stage: StageKey | null;
  today: string;
  canEdit: boolean;
  /** La columna `stage_key` existe: se puede cambiar la etapa de una tarea. */
  stageEditable: boolean;
  /** Cambia para enfocar el campo "Agregar tarea" (botón "Nueva tarea"). */
  focusAddSignal: number;
  onMove: (task: PlanTask, column: BoardColumn) => void;
  onCreate: (title: string) => Promise<boolean>;
  onDelete: (task: PlanTask) => void;
  onChangeStage: (task: PlanTask, stage: StageKey | null) => void;
  /** La columna `approved_at` existe: se puede marcar "aprobada por el cliente". */
  canApprove: boolean;
  onDelivery: (task: PlanTask, action: DeliveryAction) => void;
  /** Señales de la plataforma: tareas estándar que parecen hechas ("Detectado ✓ — revisar"). */
  signals: SignalSet;
}

function stageLabelOf(stages: readonly PlanStage[], key: StageKey | null): string | null {
  return key ? (stages.find((s) => s.key === key)?.label ?? null) : null;
}

function stageOfTask(task: PlanTask, stages: readonly PlanStage[]): StageKey | null {
  return taskStageKey(
    task,
    stages.map((s) => s.key),
  );
}

/** Tablero Por hacer / En curso / Lista. Se arrastra entre columnas o se usa el menú. */
export function TaskBoard(props: TaskBoardProps) {
  const { tasks, canEdit, onMove } = props;
  const [dragging, setDragging] = useState<PlanTask | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byColumn = (column: BoardColumn) => tasks.filter((t) => taskColumn(t.status) === column);

  const handleStart = (e: DragStartEvent) =>
    setDragging(tasks.find((t) => t.id === e.active.id) ?? null);
  const handleEnd = (e: DragEndEvent) => {
    setDragging(null);
    const task = tasks.find((t) => t.id === e.active.id);
    const column = e.over?.id as BoardColumn | undefined;
    if (!task || !column || taskColumn(task.status) === column) return;
    onMove(task, column);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setDragging(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Para mover una tarea, presiona espacio, usa las flechas para cambiar de columna y espacio otra vez para soltarla.",
        },
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:min-h-0 md:flex-1 md:grid-cols-3 md:grid-rows-[minmax(0,1fr)]">
        {BOARD_COLUMNS.map((column) => (
          <BoardColumnView
            key={column}
            column={column}
            tasks={byColumn(column)}
            board={props}
            dragDisabled={!canEdit}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <TaskCardBody
            task={dragging}
            today={props.today}
            stageLabel={
              props.stage
                ? null
                : stageLabelOf(props.planStages, stageOfTask(dragging, props.planStages))
            }
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumnView({
  column,
  tasks,
  board,
  dragDisabled,
}: {
  column: BoardColumn;
  tasks: readonly PlanTask[];
  board: TaskBoardProps;
  dragDisabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column, disabled: dragDisabled });
  const label = BOARD_COLUMN_LABELS[column];
  return (
    <section
      ref={setNodeRef}
      aria-label={`${label} (${tasks.length})`}
      className={cn(
        "flex min-w-0 flex-col rounded-app-lg border border-border-subtle bg-muted/30 p-2 transition-colors md:min-h-0",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <header className="flex shrink-0 items-center justify-between px-1 pb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span aria-hidden className={cn("h-2 w-2 rounded-full", COLUMN_DOT[column])} />
          {label}
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">{tasks.length}</span>
      </header>
      {column === "todo" && board.canEdit && (
        <QuickAdd
          onCreate={board.onCreate}
          focusSignal={board.focusAddSignal}
          stageLabel={stageLabelOf(board.planStages, board.stage)}
        />
      )}
      {tasks.length === 0 ? (
        <p className="px-1 py-3 text-center text-xs text-muted-foreground">
          {column === "done" ? "Nada terminado todavía." : "Sin tareas."}
        </p>
      ) : (
        <FitList
          items={tasks}
          getKey={(t) => t.id}
          label={`Tareas: ${label}`}
          gap={6}
          divided={false}
          mobileShowAll
          renderItem={(task, ctx) =>
            ctx.inSheet ? (
              <TaskCard task={task} board={board} draggable={false} />
            ) : (
              <TaskCard task={task} board={board} draggable={!dragDisabled} />
            )
          }
        />
      )}
    </section>
  );
}

function QuickAdd({
  onCreate,
  focusSignal,
  stageLabel,
}: {
  onCreate: (title: string) => Promise<boolean>;
  focusSignal: number;
  stageLabel: string | null;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSignal > 0) inputRef.current?.focus();
  }, [focusSignal]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean || saving) return;
    setSaving(true);
    const ok = await onCreate(clean);
    setSaving(false);
    if (ok) setTitle("");
  };

  return (
    <form onSubmit={submit} className="mb-2 flex shrink-0 items-center gap-1">
      <Input
        ref={inputRef}
        value={title}
        maxLength={TITLE_MAX}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={stageLabel ? `Agregar tarea a ${stageLabel}…` : "Agregar tarea…"}
        aria-label="Nueva tarea"
        className="h-8 bg-surface text-sm"
        disabled={saving}
      />
      <Button
        type="submit"
        size="icon"
        variant="outline"
        className="h-8 w-8 shrink-0"
        aria-label="Agregar tarea"
        disabled={saving || !title.trim()}
      >
        <Plus aria-hidden className="h-4 w-4" />
      </Button>
    </form>
  );
}

function TaskCard({
  task,
  board,
  draggable,
}: {
  task: PlanTask;
  board: TaskBoardProps;
  draggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !draggable,
  });
  return (
    <div ref={setNodeRef} className={cn("group relative", isDragging && "opacity-40")}>
      <TaskCardBody
        task={task}
        today={board.today}
        stageLabel={
          board.stage ? null : stageLabelOf(board.planStages, stageOfTask(task, board.planStages))
        }
        detected={detectedSignal(task, board.signals)}
        onConfirm={board.canEdit ? () => board.onMove(task, "done") : undefined}
        handle={
          draggable ? (
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label={`Arrastrar «${task.title}» a otra columna`}
              className="flex cursor-grab touch-none items-center rounded-app-sm text-muted-foreground/50 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            >
              <GripVertical aria-hidden className="h-3.5 w-3.5" />
            </button>
          ) : null
        }
        menu={board.canEdit ? <TaskMenu task={task} board={board} /> : null}
      />
    </div>
  );
}

function TaskCardBody({
  task,
  today,
  stageLabel,
  handle,
  menu,
  overlay,
  detected = null,
  onConfirm,
}: {
  task: PlanTask;
  today: string;
  /** Etiqueta de la etapa (solo en la vista "todas las etapas"). */
  stageLabel: string | null;
  /** Señal detectada en la plataforma (tarea estándar abierta que parece hecha). */
  detected?: PlanSignal | null;
  /** Confirma la tarea detectada (la pasa a Lista). */
  onConfirm?: () => void;
  handle?: ReactNode;
  menu?: ReactNode;
  overlay?: boolean;
}) {
  const done = taskColumn(task.status) === "done";
  const late = Boolean(
    task.due_date && task.due_date < today && taskColumn(task.status) !== "done",
  );
  const delivery = deliveryState(task);
  const template = isTemplateTask(task);
  return (
    <article
      className={cn(
        "flex items-start gap-1.5 rounded-app-md border border-border-subtle bg-surface px-2 py-1.5 shadow-app-xs",
        overlay && "rotate-1 shadow-app-md",
      )}
    >
      {handle && <span className="mt-0.5 shrink-0">{handle}</span>}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "line-clamp-2 text-sm leading-snug text-foreground",
            done && "text-muted-foreground line-through",
          )}
        >
          {template && (
            <span title="Plantilla: tarea estándar del plan" className="mr-1 inline-block">
              <LayoutTemplate
                aria-hidden
                className="inline h-3 w-3 -translate-y-px text-muted-foreground/70"
              />
              <span className="sr-only">Plantilla: </span>
            </span>
          )}
          {task.title}
        </p>
        {detected && <DetectedBadge signal={detected} />}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <DeliveryMark state={delivery} />
          {stageLabel && (
            <span className="max-w-[9rem] truncate rounded-full bg-primary/10 px-1.5 py-px font-medium text-primary">
              {stageLabel}
            </span>
          )}
          {task.due_date && (
            <span
              className={cn(
                "flex items-center gap-0.5 tabular-nums",
                late && "font-medium text-danger-strong",
              )}
            >
              <Calendar aria-hidden className="h-3 w-3" />
              {formatShortDate(task.due_date)}
              {late && <span className="sr-only"> (atrasada)</span>}
            </span>
          )}
          {task.assignee && <Assignee name={task.assignee} />}
          {detected && onConfirm && <ConfirmButton signal={detected} onConfirm={onConfirm} />}
        </div>
      </div>
      {menu}
    </article>
  );
}

/** Responsable: foto (o iniciales) del equipo; un nombre que no es del equipo, con ícono. */
function Assignee({ name }: { name: string }) {
  const member = teamMemberByName(name);
  return (
    <span className="flex min-w-0 items-center gap-1" title={`Responsable: ${name}`}>
      {member ? (
        <TeamAvatar
          member={member}
          className="h-4 w-4 ring-0"
          fallbackClassName="text-[8px] font-semibold"
        />
      ) : (
        <User aria-hidden className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

function TaskMenu({ task, board }: { task: PlanTask; board: TaskBoardProps }) {
  const current = taskColumn(task.status);
  const stage = stageOfTask(task, board.planStages);
  const delivery = deliveryState(task);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 text-muted-foreground"
          aria-label={`Acciones de «${task.title}»`}
        >
          <MoreHorizontal aria-hidden className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Mover a</DropdownMenuLabel>
        {BOARD_COLUMNS.filter((c) => c !== current).map((column) => (
          <DropdownMenuItem key={column} onSelect={() => board.onMove(task, column)}>
            {BOARD_COLUMN_LABELS[column]}
          </DropdownMenuItem>
        ))}
        {board.stageEditable && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              Etapa: {stageLabelOf(board.planStages, stage) ?? "Sin etapa"}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {board.planStages.map((s) => (
                <DropdownMenuItem
                  key={s.key}
                  disabled={s.key === stage}
                  onSelect={() => board.onChangeStage(task, s.key)}
                >
                  {s.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => board.onChangeStage(task, null)}>
                Sin etapa
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Entrega</DropdownMenuLabel>
        {(delivery === "open" || delivery === "done") && (
          <DropdownMenuItem onSelect={() => board.onDelivery(task, "deliver")}>
            Marcar entregada al cliente
          </DropdownMenuItem>
        )}
        {board.canApprove && delivery !== "approved" && (
          <DropdownMenuItem onSelect={() => board.onDelivery(task, "approve")}>
            Marcar aprobada por el cliente
          </DropdownMenuItem>
        )}
        {(delivery === "delivered" || delivery === "approved") && (
          <DropdownMenuItem onSelect={() => board.onDelivery(task, "undo")}>
            Quitar entrega
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-danger-strong focus:text-danger-strong"
          onSelect={() => board.onDelete(task)}
        >
          Eliminar tarea
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Detectado ✓ — revisar": la plataforma indica que ya está hecha; nunca se completa sola. */
function DetectedBadge({ signal }: { signal: PlanSignal }) {
  return (
    <span
      title={SIGNAL_LABELS[signal]}
      className="mt-1 inline-block whitespace-nowrap rounded-full bg-success-subtle px-1.5 py-px text-[11px] font-medium text-success-strong"
    >
      Detectado ✓ — revisar
      <span className="sr-only">: {SIGNAL_LABELS[signal]}</span>
    </span>
  );
}

/** Confirma una tarea detectada (la pasa a Lista con un clic). */
function ConfirmButton({ signal, onConfirm }: { signal: PlanSignal; onConfirm: () => void }) {
  return (
    <button
      type="button"
      onClick={onConfirm}
      title={`${SIGNAL_LABELS[signal]}. Confirmar y marcar lista`}
      className="ml-auto shrink-0 rounded-app-sm px-0.5 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Confirmar
    </button>
  );
}

/** Esqueleto del tablero mientras cargan las tareas. */
export function TaskBoardSkeleton() {
  return (
    <div role="status" aria-busy className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <span className="sr-only">Cargando tareas</span>
      {BOARD_COLUMNS.map((c) => (
        <div key={c} className="space-y-2 rounded-app-lg border border-border-subtle p-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

/** ✓ lista interna · ✓✓ gris entregada · ✓✓ azul aprobada por el cliente (como WhatsApp). */
export function DeliveryMark({ state }: { state: DeliveryState }) {
  if (state === "open") return null;
  const Icon = state === "done" ? Check : CheckCheck;
  return (
    <span
      title={DELIVERY_LABELS[state]}
      className={cn(
        "flex items-center",
        state === "approved" ? "text-info" : "text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      <span className="sr-only">{DELIVERY_LABELS[state]}</span>
    </span>
  );
}
