/** Fechas del reporte mensual. Todo se calcula en hora de Chile. */
import { BILLING_TIME_ZONE, firstDayOfMonth, todayInChile } from "@/lib/billing/dates";

export const REPORT_TIME_ZONE = BILLING_TIME_ZONE;

const PERIOD_RE = /^(\d{4})-(\d{2})-01$/;
const pad = (n: number) => String(n).padStart(2, "0");

export function isValidPeriod(value: string): boolean {
  const m = PERIOD_RE.exec(value);
  if (!m) return false;
  const month = Number(m[2]);
  return month >= 1 && month <= 12;
}

function parsePeriod(period: string): { y: number; m: number } {
  const match = PERIOD_RE.exec(period);
  if (!match) throw new Error(`Periodo inválido: ${period}`);
  return { y: Number(match[1]), m: Number(match[2]) };
}

/** "2026-10-01" → "2026-09-01". */
export function previousPeriod(period: string): string {
  const { y, m } = parsePeriod(period);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${pad(m - 1)}-01`;
}

/** "2026-09-01" → "2026-10-01". */
export function nextPeriod(period: string): string {
  const { y, m } = parsePeriod(period);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
}

/** Último día del mes ("2026-09-01" → "2026-09-30"). */
export function lastDayOfPeriod(period: string): string {
  const { y, m } = parsePeriod(period);
  return `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
}

/** Periodo a reportar: el mes anterior al de hoy (hora de Chile). */
export function defaultReportPeriod(now: Date = new Date()): string {
  return previousPeriod(firstDayOfMonth(todayInChile(now)));
}

/** Resta días a una fecha "YYYY-MM-DD". */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Desfase (ms) de la zona horaria respecto de UTC en el instante dado. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - instant;
}

/** Medianoche local (Chile) de `iso` expresada como instante UTC ISO. */
export function chileMidnightUtc(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let instant = guess - zoneOffsetMs(guess, REPORT_TIME_ZONE);
  // Segunda pasada por si el cambio de horario cae entre medio.
  instant = guess - zoneOffsetMs(instant, REPORT_TIME_ZONE);
  return new Date(instant).toISOString();
}

/** Fecha local de Chile ("YYYY-MM-DD") de un instante. */
export function chileDate(instant: string | Date): string {
  return todayInChile(typeof instant === "string" ? new Date(instant) : instant);
}

export interface PeriodRange {
  period: string;
  /** Fechas locales inclusivas para columnas `date`. */
  firstDay: string;
  lastDay: string;
  /** Instantes UTC [desde, hasta) para columnas timestamptz. */
  fromUtc: string;
  toUtc: string;
}

export function periodRange(period: string): PeriodRange {
  return {
    period,
    firstDay: period,
    lastDay: lastDayOfPeriod(period),
    fromUtc: chileMidnightUtc(period),
    toUtc: chileMidnightUtc(nextPeriod(period)),
  };
}
