import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type KeyboardCoordinateGetter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CLOSED_STATES,
  COLD_STATE,
  OPEN_STATES,
  STATE_META,
  isProspectState,
  type ProspectState,
} from "@/lib/prospects/schema";
import { CardBody, ProspectCard, type CardActions } from "./ProspectCard";
import type { Prospect } from "./prospectsData";

const DRAG_DISTANCE_PX = 6;
const COLUMN_PREFIX = "col:";

function labelOf(id: string | number | undefined): string {
  const state = String(id ?? "").replace(COLUMN_PREFIX, "");
  return isProspectState(state) ? STATE_META[state].label : "fuera de una columna";
}

function makeAnnouncements(byId: Map<string, Prospect>): Announcements {
  const name = (id: string | number) => byId.get(String(id))?.nombre ?? "Prospecto";
  return {
    onDragStart: ({ active }) => `Tomaste ${name(active.id)}.`,
    onDragOver: ({ active, over }) =>
      `${name(active.id)} está sobre la columna ${labelOf(over?.id)}.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${name(active.id)} se soltó en ${labelOf(over.id)}.`
        : `${name(active.id)} se soltó sin cambios.`,
    onDragCancel: ({ active }) => `Se canceló el arrastre de ${name(active.id)}.`,
  };
}

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp"]);
const DROP_OFFSET_PX = 12;

/**
 * Con teclado, las flechas saltan de columna en columna (izq./arriba = anterior,
 * der./abajo = siguiente) en vez de mover la tarjeta píxel a píxel.
 */
const columnCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context, currentCoordinates },
) => {
  const forward = NEXT_KEYS.has(event.code);
  if (!forward && !PREV_KEYS.has(event.code)) return undefined;
  event.preventDefault();
  const columns = context.droppableContainers
    .getEnabled()
    .map((c) => ({ id: String(c.id), rect: context.droppableRects.get(c.id) }))
    .filter((c): c is { id: string; rect: NonNullable<typeof c.rect> } => Boolean(c.rect))
    .sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top);
  if (columns.length === 0) return currentCoordinates;
  const currentIndex = columns.findIndex((c) => c.id === String(context.over?.id ?? ""));
  const nextIndex =
    currentIndex === -1
      ? 0
      : Math.min(columns.length - 1, Math.max(0, currentIndex + (forward ? 1 : -1)));
  const target = columns[nextIndex].rect;
  // Igual que sortableKeyboardCoordinates: compensar la distancia entre el puntero y la tarjeta.
  const collision = context.collisionRect;
  const offsetX = collision ? currentCoordinates.x - collision.left : 0;
  const offsetY = collision ? currentCoordinates.y - collision.top : 0;
  return { x: target.left + DROP_OFFSET_PX + offsetX, y: target.top + DROP_OFFSET_PX + offsetY };
};

const SCREEN_READER_INSTRUCTIONS =
  "Para mover una tarjeta, enfoca su asa y presiona espacio. Usa las flechas para cambiar de columna, " +
  "espacio para soltar o escape para cancelar. También puedes usar el selector de estado de cada tarjeta.";

function Column({
  state,
  title,
  count,
  children,
  className,
  headerAction,
}: {
  state: ProspectState;
  title: string;
  count: number;
  children?: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${state}` });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${title}: ${count}`}
      className={cn(
        "flex flex-col rounded-app-lg border border-border-subtle bg-surface-2 p-2 transition-colors md:min-h-0",
        isOver && "border-primary bg-primary/5",
        className,
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 px-1 pb-2">
        <h2 className="text-sm font-semibold text-foreground">
          {title}{" "}
          <span className="ml-1 text-xs font-normal tabular-nums text-muted-foreground">
            {count}
          </span>
        </h2>
        {headerAction}
      </header>
      {/* En escritorio cada columna hace scroll por dentro: la página no crece. */}
      <div className="-mx-1 px-1 md:min-h-0 md:flex-1 md:overflow-y-auto">{children}</div>
    </section>
  );
}

function CardList({ items, actions }: { items: Prospect[]; actions: CardActions }) {
  if (items.length === 0) {
    return (
      <p className="rounded-app-md border border-dashed border-border-strong p-3 text-center text-xs text-muted-foreground">
        Suelta aquí
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((p) => (
        <ProspectCard key={p.id} prospect={p} actions={actions} />
      ))}
    </ul>
  );
}

export function KanbanBoard({
  prospects,
  actions,
}: {
  prospects: Prospect[];
  actions: CardActions;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_DISTANCE_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinateGetter }),
  );

  const byId = useMemo(() => new Map(prospects.map((p) => [p.id, p])), [prospects]);
  const byState = useMemo(() => {
    const groups = new Map<string, Prospect[]>();
    for (const p of prospects) groups.set(p.estado, [...(groups.get(p.estado) ?? []), p]);
    return groups;
  }, [prospects]);
  const announcements = useMemo(() => makeAnnouncements(byId), [byId]);
  const closedCount = CLOSED_STATES.reduce((n, s) => n + (byState.get(s)?.length ?? 0), 0);
  const active = activeId ? byId.get(activeId) : undefined;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const prospect = byId.get(String(e.active.id));
    const target = String(e.over?.id ?? "").replace(COLUMN_PREFIX, "");
    if (prospect && isProspectState(target) && target !== prospect.estado)
      actions.onMove(prospect, target);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: SCREEN_READER_INSTRUCTIONS },
      }}
    >
      <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-3 md:h-full md:pb-1">
        {OPEN_STATES.map((state) => {
          const items = byState.get(state) ?? [];
          return (
            <Column
              key={state}
              state={state}
              title={STATE_META[state].label}
              count={items.length}
              className="w-64 shrink-0"
            >
              <CardList items={items} actions={actions} />
            </Column>
          );
        })}
        <Column
          state={COLD_STATE}
          title="Fríos"
          count={byState.get(COLD_STATE)?.length ?? 0}
          className="w-64 shrink-0"
        >
          <p className="px-1 pb-2 text-xs text-muted-foreground">
            Guardados sin insistir. Para retomar, muévelo a Nuevo o Contactado.
          </p>
          <CardList items={byState.get(COLD_STATE) ?? []} actions={actions} />
        </Column>
        <ClosedColumn
          open={closedOpen}
          onToggle={() => setClosedOpen((o) => !o)}
          count={closedCount}
          byState={byState}
          actions={actions}
        />
      </div>
      <DragOverlay>
        {active ? (
          <div className="w-60 rounded-app-md border border-primary bg-surface p-3 shadow-app-lg">
            <CardBody prospect={active} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Columna "Cerrados": colapsada recibe tarjetas como "perdido"; abierta separa perdido y baja. */
function ClosedColumn({
  open,
  onToggle,
  count,
  byState,
  actions,
}: {
  open: boolean;
  onToggle: () => void;
  count: number;
  byState: Map<string, Prospect[]>;
  actions: CardActions;
}) {
  const toggle = (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex items-center gap-1 rounded-app-sm px-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {open ? (
        <ChevronDown aria-hidden className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight aria-hidden className="h-3.5 w-3.5" />
      )}
      {open ? "Ocultar" : "Ver"}
    </button>
  );

  if (!open) {
    return (
      <Column
        state="perdido"
        title="Cerrados"
        count={count}
        className="w-40 shrink-0"
        headerAction={toggle}
      >
        <p className="px-1 text-xs text-muted-foreground">
          Perdidos y bajas. Suelta aquí para marcar como perdido.
        </p>
      </Column>
    );
  }

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2 md:min-h-0">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-semibold">Cerrados</span>
        {toggle}
      </div>
      {CLOSED_STATES.map((state) => {
        const items = byState.get(state) ?? [];
        return (
          <Column
            key={state}
            state={state}
            title={STATE_META[state].label}
            count={items.length}
            className="md:flex-1"
          >
            <CardList items={items} actions={actions} />
          </Column>
        );
      })}
    </div>
  );
}
