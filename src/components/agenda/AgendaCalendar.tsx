import { CalendarX2 } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { EmptyState } from "@/components/app";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  addDays,
  addMonths,
  dayOfMonth,
  daysInRange,
  formatLongDay,
  formatShortDay,
  sameMonth,
  startOfWeek,
  weekdayIndex,
} from "@/lib/agenda/dates";
import {
  AGENDA_KIND_LABEL_PLURAL,
  type AgendaItem,
  type AgendaKind,
  type AgendaRange,
  type AgendaView,
} from "@/lib/agenda/types";
import { cn } from "@/lib/utils";
import { AgendaChip } from "./AgendaChip";
import { itemStyle } from "./agendaStyles";

const MAX_CHIPS = 3;
const MAX_DOTS = 4;
const DAYS_PER_WEEK = 7;

export interface AgendaCalendarProps {
  view: AgendaView;
  range: AgendaRange;
  /** Día seleccionado (también ancla del mes/semana visible). */
  selected: string;
  today: string;
  itemsByDay: ReadonlyMap<string, readonly AgendaItem[]>;
  onSelectDay: (day: string) => void;
}

/** Atajos de teclado del calendario (patrón de grilla de fechas de WAI-ARIA). */
function nextDayForKey(key: string, day: string): string | null {
  switch (key) {
    case "ArrowLeft":
      return addDays(day, -1);
    case "ArrowRight":
      return addDays(day, 1);
    case "ArrowUp":
      return addDays(day, -DAYS_PER_WEEK);
    case "ArrowDown":
      return addDays(day, DAYS_PER_WEEK);
    case "Home":
      return startOfWeek(day);
    case "End":
      return addDays(startOfWeek(day), DAYS_PER_WEEK - 1);
    case "PageUp":
      return addMonths(day, -1);
    case "PageDown":
      return addMonths(day, 1);
    default:
      return null;
  }
}

function summarize(items: readonly AgendaItem[]): string {
  if (items.length === 0) return "sin eventos";
  const counts = new Map<AgendaKind, number>();
  for (const it of items) counts.set(it.kind, (counts.get(it.kind) ?? 0) + 1);
  return [...counts.entries()]
    .map(([kind, n]) => `${n} ${AGENDA_KIND_LABEL_PLURAL[kind].toLowerCase()}`)
    .join(", ");
}

function dayLabel(day: string, today: string, items: readonly AgendaItem[]): string {
  return `${today === day ? "Hoy, " : ""}${formatLongDay(day)}: ${summarize(items)}`;
}

/** Mueve el foco al día seleccionado tras navegar con teclado. */
function useFocusSelected(selected: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    containerRef.current
      ?.querySelector<HTMLButtonElement>(`button[data-day="${selected}"]`)
      ?.focus();
  }, [selected]);
  return { containerRef, pendingFocus };
}

export function AgendaCalendar(props: AgendaCalendarProps) {
  if (props.view === "semana") return <WeekView {...props} />;
  if (props.view === "lista") return <ListView {...props} />;
  return <MonthView {...props} />;
}

function useGridKeys(selected: string, onSelectDay: (d: string) => void) {
  const { containerRef, pendingFocus } = useFocusSelected(selected);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const from = target.dataset.day;
    if (!from) return;
    const next = nextDayForKey(e.key, from);
    if (!next) return;
    e.preventDefault();
    pendingFocus.current = true;
    onSelectDay(next);
  };
  return { containerRef, onKeyDown };
}

// ─── Mes ────────────────────────────────────────────────────────────────────

function MonthView({ range, selected, today, itemsByDay, onSelectDay }: AgendaCalendarProps) {
  const { containerRef, onKeyDown } = useGridKeys(selected, onSelectDay);
  const days = daysInRange(range);
  const weeks = Array.from({ length: Math.ceil(days.length / DAYS_PER_WEEK) }, (_, i) =>
    days.slice(i * DAYS_PER_WEEK, (i + 1) * DAYS_PER_WEEK),
  );

  return (
    <div
      ref={containerRef}
      role="grid"
      aria-label="Calendario del mes. Usa las flechas para moverte entre días."
      onKeyDown={onKeyDown}
      className="w-full"
    >
      <div role="row" className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAY_SHORT.map((d, i) => (
          <div
            key={d}
            role="columnheader"
            aria-label={WEEKDAY_LONG[i]}
            className="px-1 text-center text-[11px] font-medium text-muted-foreground sm:text-left"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week) => (
          <div key={week[0]} role="row" className="grid grid-cols-7 gap-1">
            {week.map((day) => {
              const items = itemsByDay.get(day) ?? [];
              const isSelected = day === selected;
              const isToday = day === today;
              const outside = !sameMonth(day, selected);
              return (
                <div key={day} role="gridcell" aria-selected={isSelected} className="min-w-0">
                  <button
                    type="button"
                    data-day={day}
                    tabIndex={isSelected ? 0 : -1}
                    aria-label={dayLabel(day, today, items)}
                    aria-current={isToday ? "date" : undefined}
                    onClick={() => onSelectDay(day)}
                    className={cn(
                      "flex h-14 w-full flex-col gap-1 overflow-hidden rounded-app-sm border p-1 text-left transition-colors sm:h-28 sm:p-1.5",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border-subtle hover:bg-surface-2",
                      outside && "opacity-50",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-medium",
                        isToday && "bg-primary text-primary-foreground",
                      )}
                    >
                      {dayOfMonth(day)}
                    </span>
                    <DayDots items={items} />
                    <div aria-hidden className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                      {items.slice(0, MAX_CHIPS).map((it) => (
                        <AgendaChip key={it.id} item={it} />
                      ))}
                      {items.length > MAX_CHIPS && (
                        <span className="px-1 text-[11px] text-muted-foreground">
                          +{items.length - MAX_CHIPS} más
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Móvil: puntos de color + contador (la cifra y el panel del día dan el detalle). */
function DayDots({ items }: { items: readonly AgendaItem[] }) {
  if (items.length === 0) return null;
  return (
    <span aria-hidden className="flex flex-wrap items-center gap-0.5 sm:hidden">
      {items.slice(0, MAX_DOTS).map((it) => (
        <span key={it.id} className={cn("h-1.5 w-1.5 rounded-full", itemStyle(it).dot)} />
      ))}
      {items.length > MAX_DOTS && (
        <span className="text-[10px] leading-none text-muted-foreground">
          +{items.length - MAX_DOTS}
        </span>
      )}
    </span>
  );
}

// ─── Semana ─────────────────────────────────────────────────────────────────

function WeekView({ range, selected, today, itemsByDay, onSelectDay }: AgendaCalendarProps) {
  const { containerRef, onKeyDown } = useGridKeys(selected, onSelectDay);
  const days = daysInRange(range);
  return (
    <div
      ref={containerRef}
      onKeyDown={onKeyDown}
      className="grid grid-cols-1 gap-2 sm:grid-cols-7 sm:gap-1"
    >
      {days.map((day) => {
        const items = itemsByDay.get(day) ?? [];
        const isSelected = day === selected;
        const isToday = day === today;
        return (
          <section
            key={day}
            aria-label={formatLongDay(day)}
            className={cn(
              "flex min-w-0 flex-col gap-1.5 rounded-app-sm border p-1.5 sm:min-h-64",
              isSelected ? "border-primary bg-primary/5" : "border-border-subtle",
            )}
          >
            <button
              type="button"
              data-day={day}
              tabIndex={isSelected ? 0 : -1}
              aria-pressed={isSelected}
              aria-label={dayLabel(day, today, items)}
              aria-current={isToday ? "date" : undefined}
              onClick={() => onSelectDay(day)}
              className="flex items-center gap-2 rounded-app-sm px-1 py-0.5 text-left text-xs hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-medium text-muted-foreground">
                {WEEKDAY_SHORT[weekdayIndex(day)]}
              </span>
              <span
                className={cn(
                  "grid h-6 min-w-6 place-items-center rounded-full px-1 font-medium",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {formatShortDay(day)}
              </span>
              {isToday && <span className="sr-only">(hoy)</span>}
            </button>
            {items.length === 0 ? (
              <p className="px-1 text-[11px] text-muted-foreground sm:sr-only">Sin eventos</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {items.map((it) => (
                  <li key={it.id} className="min-w-0">
                    <AgendaChip item={it} asLink />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ─── Lista (pensada para móvil) ─────────────────────────────────────────────

function ListView({ range, today, itemsByDay }: AgendaCalendarProps) {
  const days = daysInRange(range).filter((d) => (itemsByDay.get(d) ?? []).length > 0);
  if (days.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={CalendarX2}
        title="Sin eventos este mes"
        description="Prueba otro mes o quita filtros."
      />
    );
  }
  return (
    <ol className="space-y-4">
      {days.map((day) => (
        <li key={day}>
          <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold capitalize text-muted-foreground">
            {formatLongDay(day)}
            {day === today && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] normal-case text-primary-foreground">
                Hoy
              </span>
            )}
          </h3>
          <ul className="space-y-1">
            {(itemsByDay.get(day) ?? []).map((it) => (
              <li key={it.id}>
                <AgendaChip item={it} asLink className="py-1.5 text-xs" />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

// ─── Carga ──────────────────────────────────────────────────────────────────

export function AgendaCalendarSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy className="space-y-1">
      <span className="sr-only">Cargando agenda…</span>
      {Array.from({ length: 5 }, (_, r) => (
        <div key={r} className="grid grid-cols-7 gap-1">
          {Array.from({ length: DAYS_PER_WEEK }, (_, c) => (
            <Skeleton key={c} className="h-14 rounded-app-sm sm:h-28" />
          ))}
        </div>
      ))}
    </div>
  );
}
