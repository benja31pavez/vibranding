/** ISO → "4 oct 2026"; "—" si no hay fecha. */
export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

/** ISO → "YYYY-MM-DD" (hora de Chile) para un <input type="date">. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

const MS_PER_DAY = 86_400_000;
/** Desde cuántos días se muestra la fecha en vez de "hace N días". */
const RELATIVE_MAX_DAYS = 30;

/** Último contacto en corto: "hoy", "ayer", "hace 5 días" o la fecha; null si no hay. */
export function formatContactAge(
  value: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const day = toDateInput(value);
  if (!day) return null;
  const today = toDateInput(now.toISOString());
  const days = Math.round((Date.parse(today) - Date.parse(day)) / MS_PER_DAY);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days <= RELATIVE_MAX_DAYS) return `hace ${days} días`;
  return formatShortDate(value);
}
