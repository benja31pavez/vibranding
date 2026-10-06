/**
 * Autorización de las server functions de una cuenta de WhatsApp.
 *
 * Antes bastaba con que la fila fuera visible por RLS (owns_client = cualquier
 * miembro, incluido viewer). Ahora se exige explícitamente ser editor de la
 * agencia (owner/admin/agent) de la org dueña del cliente de la cuenta.
 */
import { assertCanEditClient, ClientAccessError } from "@/lib/auth/clientAccess.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_ACCESS = "No tienes acceso a esta cuenta";

/** Devuelve el client_id de la cuenta si el usuario es editor de su agencia; si no, lanza. */
export async function assertCanEditWhatsAppAccount(
  userId: string,
  accountId: string,
): Promise<{ clientId: string }> {
  if (!accountId || !UUID_RE.test(accountId)) throw new ClientAccessError(NO_ACCESS);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("whatsapp_accounts")
    .select("client_id")
    .eq("id", accountId)
    .maybeSingle();
  if (error) {
    console.error("[whatsapp] account lookup failed", error.message);
    throw new Error("No se pudo verificar el acceso a la cuenta");
  }
  const clientId = data?.client_id;
  if (!clientId) throw new ClientAccessError(NO_ACCESS);
  await assertCanEditClient(userId, clientId);
  return { clientId };
}
