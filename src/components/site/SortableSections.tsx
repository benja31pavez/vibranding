import { ArrowDown, ArrowUp, ChevronDown, GripVertical } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/app";
import { SECTION_STATUS_UI, type SectionStatus } from "@/lib/site/siteStatus";

export type SectionRow = {
  id: string;
  title: string;
  summary: string;
  enabled: boolean;
  /** Si es false, la sección no se puede desactivar (sin switch). */
  toggleable: boolean;
  content: React.ReactNode;
  /** Muestra un punto de alerta (p. ej. error de validación). */
  hasError?: boolean;
  /** Estado visible en la cabecera (completa, falta contenido, texto de ejemplo…). */
  status?: SectionStatus;
};

/** Lista vertical reordenable con arrastrar (mouse, táctil y teclado). */
export function SortableList<T extends string>({
  ids,
  onReorder,
  getLabel,
  children,
}: {
  ids: T[];
  onReorder: (next: T[]) => void;
  /** Nombre legible de cada fila para los anuncios del lector de pantalla. */
  getLabel?: (id: T) => string;
  children: React.ReactNode;
}) {
  const label = (id: UniqueIdentifier) => (getLabel ? getLabel(id as T) : String(id));
  const position = (id: UniqueIdentifier | undefined) =>
    id === undefined ? "" : `posición ${ids.indexOf(id as T) + 1} de ${ids.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tomaste ${label(active.id)}, ${position(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${label(active.id)} está sobre la ${position(over.id)}.`
        : `${label(active.id)} está fuera de la lista.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Soltaste ${label(active.id)} en la ${position(over.id)}.`
        : `Soltaste ${label(active.id)}.`,
    onDragCancel: ({ active }) =>
      `Cancelaste el movimiento. ${label(active.id)} vuelve a su lugar.`,
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(e.active.id as T);
    const to = ids.indexOf(e.over.id as T);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Para reordenar, presiona espacio, muévete con las flechas y presiona espacio otra vez para soltar.",
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** Hook para que cada fila sea arrastrable; devuelve el handle listo para usar. */
export function useSortableRow(id: string, label: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  };
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Arrastrar para reordenar ${label}`}
      className="-ml-1 cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" aria-hidden="true" />
    </button>
  );
  return { setNodeRef, style, handle, isDragging };
}

/** Fila plegable de sección (con o sin arrastre). */
export function SectionCard({
  row,
  open,
  onToggleOpen,
  onToggleEnabled,
  onMove,
  canMoveUp,
  canMoveDown,
  handle,
  nodeRef,
  style,
  dragging,
}: {
  row: SectionRow;
  open: boolean;
  onToggleOpen: () => void;
  onToggleEnabled?: (on: boolean) => void;
  /** Botones Subir/Bajar (alternativa accesible al arrastre). */
  onMove?: (dir: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  handle?: React.ReactNode;
  nodeRef?: (el: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragging?: boolean;
}) {
  const panelId = `section-panel-${row.id}`;
  return (
    <section
      ref={nodeRef}
      style={style}
      className={`rounded-app-lg border border-border-subtle bg-surface shadow-app-xs transition-shadow ${dragging ? "shadow-xl" : ""} ${row.enabled ? "" : "opacity-70"}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {handle}
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {!row.status && (
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${row.hasError ? "bg-destructive" : row.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
              aria-hidden="true"
            />
          )}
          <span className="min-w-0 truncate font-medium">{row.title}</span>
          {(row.enabled || !row.status) && (
            <span className="hidden min-w-0 shrink-[100] truncate text-xs text-muted-foreground sm:inline">
              {row.enabled ? row.summary : "Oculta"}
            </span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {row.status && (
              <StatusBadge
                status={row.status}
                label={SECTION_STATUS_UI[row.status].label}
                tone={SECTION_STATUS_UI[row.status].tone}
              />
            )}
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </span>
        </button>
        {onMove && (
          <MoveButtons
            label={row.title}
            onMove={onMove}
            canUp={!!canMoveUp}
            canDown={!!canMoveDown}
          />
        )}
        {row.toggleable && onToggleEnabled && (
          <Switch
            checked={row.enabled}
            onCheckedChange={onToggleEnabled}
            aria-label={`Mostrar sección ${row.title}`}
          />
        )}
      </div>
      {open && (
        <div id={panelId} className="border-t border-border-subtle px-4 pb-4 pt-3">
          {row.content}
        </div>
      )}
    </section>
  );
}

export function SortableSectionCard(
  props: Omit<
    React.ComponentProps<typeof SectionCard>,
    "handle" | "nodeRef" | "style" | "dragging"
  >,
) {
  const { setNodeRef, style, handle, isDragging } = useSortableRow(props.row.id, props.row.title);
  return (
    <SectionCard
      {...props}
      handle={handle}
      nodeRef={setNodeRef}
      style={style}
      dragging={isDragging}
    />
  );
}

/** Subir / Bajar con botones: funciona con teclado y lector de pantalla sin arrastrar. */
export function MoveButtons({
  label,
  onMove,
  canUp,
  canDown,
}: {
  label: string;
  onMove: (dir: -1 | 1) => void;
  canUp: boolean;
  canDown: boolean;
}) {
  const btn =
    "grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30";
  return (
    <span className="flex shrink-0 items-center">
      <button
        type="button"
        className={btn}
        disabled={!canUp}
        onClick={() => onMove(-1)}
        aria-label={`Subir ${label}`}
      >
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={btn}
        disabled={!canDown}
        onClick={() => onMove(1)}
        aria-label={`Bajar ${label}`}
      >
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
  );
}

/** Mueve un elemento una posición sin mutar la lista. */
export function moveBy<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || to < 0 || to >= list.length) return list;
  return arrayMove(list, index, to);
}
