/** Fechas de calendario en hora de Chile (la agencia opera en America/Santiago). */

export const CHILE_TIME_ZONE = "America/Santiago";

const DAY_MS = 86_400_000;

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  // en-CA formatea como YYYY-MM-DD.
  timeZone: CHILE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de un instante en Chile como "YYYY-MM-DD". */
export function chileDate(date: Date): string {
  return ymdFormatter.format(date);
}

/** Hoy en Chile como "YYYY-MM-DD" (no en UTC: después de las 20/21 h UTC ya sería mañana). */
export function chileToday(now: Date = new Date()): string {
  return chileDate(now);
}

/** "YYYY-MM-DD" sumando días de calendario a una fecha "YYYY-MM-DD" (sin depender de la zona). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}
