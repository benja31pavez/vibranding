/** Utilidades de fecha para cobros. Todo se calcula en hora de Chile. */

export const BILLING_TIME_ZONE = "America/Santiago";

/** Fecha de hoy en Chile como "YYYY-MM-DD". */
export function todayInChile(now: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BILLING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const pad = (n: number) => String(n).padStart(2, "0");

function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) throw new Error(`Fecha inválida: ${iso}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Primer día del mes de `iso` ("2026-10-17" → "2026-10-01"). */
export function firstDayOfMonth(iso: string): string {
  const { y, m } = parseIsoDate(iso);
  return `${y}-${pad(m)}-01`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Misma fecha el mes siguiente, anclada a `anchorDay` (día de cobro) y
 * recortada al largo del mes: 31-ene → 28/29-feb → 31-mar.
 */
export function addOneMonth(iso: string, anchorDay?: number | null): string {
  const { y, m, d } = parseIsoDate(iso);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const wanted = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : d;
  return `${ny}-${pad(nm)}-${pad(Math.min(wanted, daysInMonth(ny, nm)))}`;
}

const MONTH_LABEL = new Intl.DateTimeFormat("es-CL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10-01" → "octubre de 2026". */
export function periodLabel(period: string): string {
  const { y, m } = parseIsoDate(period);
  return MONTH_LABEL.format(new Date(Date.UTC(y, m - 1, 1)));
}
