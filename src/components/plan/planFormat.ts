/** "2026-10-12" → "12 oct" (es-CL). Vacío si la fecha no es válida. */
export function formatShortDate(ymd: string): string {
  const date = new Date(`${ymd.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-CL", { day: "numeric", month: "short" }).replace(".", "");
}

/** Número compacto en es-CL (`1.250`, `3,5`). */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(value);
}
