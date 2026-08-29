// Server-only access to WhatsApp/Meta tokens.
// Tokens live encrypted in Supabase Vault; the database only stores a reference.
// The wa_get_secret / wa_set_secret functions are executable by the service role
// only, so these helpers must never be reachable from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type WaSecretKind = "access_token" | "verify_token";

export async function getWaSecret(
  accountId: string,
  kind: WaSecretKind,
): Promise<string | null> {
  const { data, error } = await (supabaseAdmin.rpc as any)("wa_get_secret", {
    _account_id: accountId,
    _kind: kind,
  });
  if (error) {
    console.error("[whatsapp] wa_get_secret failed", error.message);
    return null;
  }
  const value = typeof data === "string" ? data.trim() : "";
  return value.length > 0 ? value : null;
}

export async function setWaSecret(
  accountId: string,
  kind: WaSecretKind,
  secret: string | null,
): Promise<void> {
  const { error } = await (supabaseAdmin.rpc as any)("wa_set_secret", {
    _account_id: accountId,
    _kind: kind,
    _secret: secret,
  });
  if (error) throw new Error(error.message);
}
