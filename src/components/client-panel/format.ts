/** Formatos de fecha del panel del cliente (hora de Chile, español de Chile). */

const TZ = "America/Santiago";

const DAY_FMT = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: TZ });
const DAY_YEAR_FMT = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TZ,
});
const TIME_FMT = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TZ,
});
const DATE_KEY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

function parse(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "5 oct" (o "5 oct 2025" si es de otro año). Vacío si no es una fecha válida. */
export function formatDay(iso: string, now: Date = new Date()): string {
  const d = parse(iso);
  if (!d) return "";
  const sameYear = DATE_KEY_FMT.format(d).slice(0, 4) === DATE_KEY_FMT.format(now).slice(0, 4);
  return (sameYear ? DAY_FMT : DAY_YEAR_FMT).format(d);
}

/** "5 oct, 18:30". */
export function formatInstant(iso: string, now: Date = new Date()): string {
  const d = parse(iso);
  return d ? `${formatDay(iso, now)}, ${TIME_FMT.format(d)}` : "";
}

/** "18:30". */
export function formatTime(iso: string): string {
  const d = parse(iso);
  return d ? TIME_FMT.format(d) : "";
}

/** Para listas de chats: hora si es de hoy, si no el día. */
export function formatChatTime(iso: string, now: Date = new Date()): string {
  const d = parse(iso);
  if (!d) return "";
  return DATE_KEY_FMT.format(d) === DATE_KEY_FMT.format(now)
    ? TIME_FMT.format(d)
    : formatDay(iso, now);
}

/** "2026-10-05" en hora de Chile (para agrupar mensajes por día). */
export function chileDateKey(iso: string): string {
  const d = parse(iso);
  return d ? DATE_KEY_FMT.format(d) : "";
}
