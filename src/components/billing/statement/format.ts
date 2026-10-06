const DATE_FMT = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** YYYY-MM-DD (o timestamp) → "2 jun 2027", sin corrimiento de zona horaria. */
export function fmtDay(iso: string): string {
  return DATE_FMT.format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)).replace(/\./g, "");
}

const MONTH_FMT = new Intl.DateTimeFormat("es-CL", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** YYYY-MM-DD → "oct 2026". */
export function fmtMonth(iso: string): string {
  return MONTH_FMT.format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)).replace(/\./g, "");
}
