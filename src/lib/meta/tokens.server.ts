// Server-only access to Meta user tokens.
// Tokens live encrypted in Supabase Vault; meta_accounts only stores a reference.
// meta_get_secret / meta_set_secret are executable by the service role only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getMetaToken(accountId: string): Promise<string | null> {
  const { data, error } = await (supabaseAdmin.rpc as any)("meta_get_secret", {
    _account_id: accountId,
  });
  if (error) {
    console.error("[meta] meta_get_secret failed", error.message);
    return null;
  }
  const value = typeof data === "string" ? data.trim() : "";
  return value.length > 0 ? value : null;
}

export async function setMetaToken(accountId: string, token: string | null): Promise<void> {
  const { error } = await (supabaseAdmin.rpc as any)("meta_set_secret", {
    _account_id: accountId,
    _secret: token,
  });
  if (error) throw new Error(error.message);
}
