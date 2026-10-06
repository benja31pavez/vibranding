import { supabase } from "@/integrations/supabase/client";
import type { PaymentStatus } from "./statementData";

/** RLS oculta filas en vez de fallar: 0 filas afectadas = sin permiso. */
export const NO_PERMISSION = "No tienes permisos para esta acción";

export function writeDenied(error: unknown, rows: unknown[] | null): boolean {
  return Boolean(error) || !rows || rows.length === 0;
}

export const STATUS_LOCKED_HINT =
  "Solo un owner o admin de la organización puede cambiar el estado de un cobro.";

/**
 * El estado (y paid_at/provider) solo se cambia vía la RPC set_payment_status:
 * valida permisos (owner/admin: manages_client) y transiciones en la BD.
 * Devuelve un mensaje de error para mostrar, o null si salió bien.
 */
export async function setPaymentStatus(
  id: string,
  status: PaymentStatus,
  paidAt?: string | null,
): Promise<string | null> {
  const { error } = await supabase.rpc("set_payment_status", {
    _payment_id: id,
    _status: status,
    ...(paidAt ? { _paid_at: paidAt } : {}),
  });
  if (!error) return null;
  if (error.code === "42501") return NO_PERMISSION;
  return `No se pudo cambiar el estado: ${error.message}`;
}

export async function deletePayment(id: string): Promise<string | null> {
  const { data, error } = await supabase.from("payments").delete().eq("id", id).select("id");
  if (error) return `No se pudo eliminar el cobro: ${error.message}`;
  if (writeDenied(error, data)) return NO_PERMISSION;
  return null;
}

/** Montos en CLP: pesos enteros. */
export const toClpAmount = (raw: string | number) => Math.round(Number(raw));

/** Valor para <input type="date"> a partir de date o timestamptz. */
export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
