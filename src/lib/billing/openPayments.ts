/**
 * Reglas compartidas de cobros abiertos (pantalla "Hoy" y /billing).
 * Fechas YYYY-MM-DD en hora de Chile.
 */

/** Ventana de "por vencer" en días (hoy incluido). */
export const UPCOMING_DAYS = 7;

/** Suma días a una fecha ISO (YYYY-MM-DD) sin depender de la zona local. */
export function addIsoDays(isoDate: string, days: number): string {
  const base = Date.parse(`${isoDate.slice(0, 10)}T12:00:00Z`);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/** Último día (inclusive) de la ventana "por vencer" que parte hoy. */
export function upcomingUntil(today: string, days: number = UPCOMING_DAYS): string {
  return addIsoDays(today, days);
}

/** Pendiente con vencimiento entre hoy y hoy + `days` (ambos inclusive). */
export function isDueSoon(
  row: { status: string; due_date: string | null },
  today: string,
  days: number = UPCOMING_DAYS,
): boolean {
  if (row.status !== "pending" || !row.due_date) return false;
  const due = row.due_date.slice(0, 10);
  return due >= today && due <= upcomingUntil(today, days);
}

/** 'overdue', o 'pending' ya vencido que el cron aún no marcó. */
export function isPastDue(
  row: { status: string; due_date: string | null },
  today: string,
): boolean {
  if (row.status === "overdue") return true;
  return (
    row.status === "pending" &&
    Boolean(row.due_date) &&
    (row.due_date as string).slice(0, 10) < today
  );
}
