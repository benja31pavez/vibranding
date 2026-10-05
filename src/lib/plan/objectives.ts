/** Salud de un objetivo del cliente: ¿va en camino hacia su meta antes de la fecha límite? */

export type ObjectiveHealth = "done" | "on_track" | "at_risk" | "late" | "no_target";

export const OBJECTIVE_HEALTH_LABELS: Readonly<Record<ObjectiveHealth, string>> = {
  done: "Logrado",
  on_track: "En camino",
  at_risk: "En riesgo",
  late: "Vencido",
  no_target: "Sin meta",
};

export interface ObjectiveLike {
  readonly status: string;
  readonly target_value: number | null;
  readonly current_value: number | null;
  readonly due_date: string | null;
  readonly created_at?: string | null;
}

/** Margen: se considera en camino si el avance va a lo más 15 puntos detrás del tiempo. */
const ON_TRACK_SLACK = 0.15;
const DAY_MS = 86_400_000;

function dayNumber(ymd: string): number {
  return Math.floor(Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`) / DAY_MS);
}

/** Avance 0–1 hacia la meta (null si no hay meta numérica). */
export function objectiveProgress(o: ObjectiveLike): number | null {
  if (o.target_value == null || o.target_value === 0) return null;
  const ratio = (o.current_value ?? 0) / o.target_value;
  return Math.max(0, Math.min(1, ratio));
}

/** Compara el avance con el tiempo transcurrido entre la creación y la fecha límite. */
export function objectiveHealth(o: ObjectiveLike, today: string): ObjectiveHealth {
  const progress = objectiveProgress(o);
  if (o.status === "done" || progress === 1) return "done";
  if (o.due_date && o.due_date < today) return "late";
  if (progress === null) return "no_target";
  if (!o.due_date || !o.created_at) return progress > 0 ? "on_track" : "at_risk";
  const start = dayNumber(o.created_at);
  const span = Math.max(1, dayNumber(o.due_date) - start);
  const elapsed = Math.max(0, Math.min(1, (dayNumber(today) - start) / span));
  return progress + ON_TRACK_SLACK >= elapsed ? "on_track" : "at_risk";
}
