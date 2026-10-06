/** Utilidades de vista compartidas por la Agenda de la agencia y el Calendario del cliente. */
import {
  addDays,
  addMonths,
  dayKeyOf,
  formatMonth,
  formatShortDay,
  monthRange,
  rangeForView,
} from "./dates";
import type { AgendaItem, AgendaRange, AgendaView } from "./types";

/** Rango a consultar: la lista (móvil) siempre trae el mes completo. */
export function queryRange(view: AgendaView, anchor: string): AgendaRange {
  return view === "lista" ? monthRange(anchor) : rangeForView(view, anchor);
}

/** Avanza o retrocede una semana o un mes según la vista. */
export function step(view: AgendaView, anchor: string, dir: 1 | -1): string {
  return view === "semana" ? addDays(anchor, 7 * dir) : addMonths(anchor, dir);
}

export function periodLabel(view: AgendaView, range: AgendaRange, anchor: string): string {
  if (view !== "semana") return formatMonth(anchor);
  return `${formatShortDay(range.from)} – ${formatShortDay(addDays(range.to, -1))}`;
}

export function groupByDay(items: readonly AgendaItem[]): Map<string, AgendaItem[]> {
  return items.reduce((map, it) => {
    const key = dayKeyOf(it.date, it.allDay);
    return map.set(key, [...(map.get(key) ?? []), it]);
  }, new Map<string, AgendaItem[]>());
}
