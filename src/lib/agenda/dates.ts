/** Fechas de la Agenda. Los días se representan como "YYYY-MM-DD" en hora de Chile. */
import { BILLING_TIME_ZONE, todayInChile } from "@/lib/billing/dates";
import { zonedToUTC } from "@/lib/bookings/tz";
import type { AgendaRange, AgendaView } from "./types";

export const AGENDA_TIME_ZONE = BILLING_TIME_ZONE;
export { todayInChile };

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_PER_WEEK = 7;
/** Años aceptados en ?fecha= (evita rangos absurdos en la URL). */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DAY_KEY_RE.exec(value);
  if (!m || +m[1] < MIN_YEAR || +m[1] > MAX_YEAR) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCDate() === +m[3] && d.getUTCMonth() === +m[2] - 1;
}

function toUtcDate(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const d = toUtcDate(key);
  return fromUtcDate(new Date(d.getTime() + days * 86_400_000));
}

export function addMonths(key: string, months: number): string {
  const d = toUtcDate(key);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return fromUtcDate(new Date(Date.UTC(year, month, Math.min(d.getUTCDate(), lastDay))));
}

/** 0 = lunes … 6 = domingo. */
export function weekdayIndex(key: string): number {
  return (toUtcDate(key).getUTCDay() + 6) % DAYS_PER_WEEK;
}

export function startOfWeek(key: string): string {
  return addDays(key, -weekdayIndex(key));
}

export function startOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Días [from, to) como lista de claves. */
export function daysInRange(range: AgendaRange): string[] {
  const out: string[] = [];
  for (let k = range.from; k < range.to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Rango visible: semanas completas (lun–dom) del mes, o la semana del ancla. */
export function rangeForView(view: AgendaView, anchor: string): AgendaRange {
  if (view === "semana") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, DAYS_PER_WEEK) };
  }
  const first = startOfMonth(anchor);
  const from = startOfWeek(first);
  const nextMonth = addMonths(first, 1);
  const lastWeekStart = startOfWeek(addDays(nextMonth, -1));
  return { from, to: addDays(lastWeekStart, DAYS_PER_WEEK) };
}

/** Rango para la vista Lista: solo el mes del ancla. */
export function monthRange(anchor: string): AgendaRange {
  const from = startOfMonth(anchor);
  return { from, to: addMonths(from, 1) };
}

/** Inicio del día de Chile como timestamp UTC ISO (para filtrar columnas timestamptz). */
export function chileDayStartIso(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return zonedToUTC(y, m - 1, d, 0, 0, AGENDA_TIME_ZONE).toISOString();
}

const DAY_KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: AGENDA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día de Chile de un evento: fechas puras se usan tal cual; timestamps se convierten. */
export function dayKeyOf(date: string, allDay: boolean): string {
  return allDay ? date.slice(0, 10) : DAY_KEY_FMT.format(new Date(date));
}

const TIME_FMT = new Intl.DateTimeFormat("es-CL", {
  timeZone: AGENDA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatTime(iso: string): string {
  return TIME_FMT.format(new Date(iso));
}

// Las claves de día se formatean en UTC para no desplazarlas por la zona del navegador.
const LONG_DAY_FMT = new Intl.DateTimeFormat("es-CL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const MONTH_FMT = new Intl.DateTimeFormat("es-CL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const SHORT_DAY_FMT = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatLongDay(key: string): string {
  return LONG_DAY_FMT.format(toUtcDate(key));
}

export function formatMonth(key: string): string {
  return MONTH_FMT.format(toUtcDate(key));
}

export function formatShortDay(key: string): string {
  return SHORT_DAY_FMT.format(toUtcDate(key));
}

export function dayOfMonth(key: string): number {
  return Number(key.slice(8, 10));
}

export const WEEKDAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
export const WEEKDAY_LONG = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;
