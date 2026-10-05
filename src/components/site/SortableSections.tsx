import { ChevronDown, GripVertical } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
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
};

/** Lista vertical reordenable con arrastrar (mouse, táctil y teclado). */
export function SortableList<T extends string>({
  ids,
  onReorder,
  children,
}: {
  ids: T[];
  onReorder: (next: T[]) => void;
  children: React.ReactNode;
}) {
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
  handle,
  nodeRef,
  style,
  dragging,
}: {
  row: SectionRow;
  open: boolean;
  onToggleOpen: () => void;
  onToggleEnabled?: (on: boolean) => void;
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
      className={`rounded-2xl border bg-surface transition-shadow ${dragging ? "shadow-xl" : ""} ${row.enabled ? "" : "opacity-70"}`}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        {handle}
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${row.hasError ? "bg-destructive" : row.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
            aria-hidden="true"
          />
          <span className="truncate font-medium">{row.title}</span>
          <span className="truncate text-xs text-muted-foreground">
            {row.enabled ? row.summary : "Oculta"}
          </span>
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {row.toggleable && onToggleEnabled && (
          <Switch
            checked={row.enabled}
            onCheckedChange={onToggleEnabled}
            aria-label={`Mostrar sección ${row.title}`}
          />
        )}
      </div>
      {open && (
        <div id={panelId} className="border-t px-4 pb-4 pt-3">
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
