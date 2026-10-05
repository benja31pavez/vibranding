/**
 * Tolerancia mientras no se aplique la migración 20261012001100_precios_mas_iva.sql.
 *
 * Antes de esa migración, los CHECK de `client_billing.plan_key`,
 * `subscriptions.plan_key`, `proposals.plan_key` y la función
 * `convert_prospect_to_client` solo aceptan marca-web | contenido | crecimiento.
 * Si se intenta guardar "mantencion" la BD responde 23514 (check_violation) o
 * 22023 (plan_key inválido). En ese caso se reintenta con plan_key = null y se
 * avisa: el monto y el detalle (ítems de la propuesta) se guardan igual.
 */
import type { PlanKey } from "./plans";

/** Planes que la BD acepta sin la migración nueva. */
const LEGACY_DB_PLAN_KEYS: readonly PlanKey[] = ["marca-web", "contenido", "crecimiento"];

export const PLAN_KEY_PENDING_MIGRATION_MSG =
  "El plan Mantención quedará registrado cuando se aplique la migración de precios + IVA; por ahora se guardó sin plan asociado.";

export function needsNewPlanMigration(planKey: string | null | undefined): boolean {
  return Boolean(planKey) && !(LEGACY_DB_PLAN_KEYS as readonly string[]).includes(planKey ?? "");
}

/** true si el error de la BD es el CHECK/validación de plan_key (falta la migración). */
export function isPlanKeyRejected(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "23514") return message.includes("plan_key");
  if (error.code === "22023") return message.includes("plan_key");
  return false;
}
