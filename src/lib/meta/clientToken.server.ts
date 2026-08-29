// Server-only: resolve the Meta token stored in Vault for a given client.
// Never read tokens from env vars: every client has its own token (OAuth user
// token or System User permanent token) referenced from meta_accounts.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMetaToken } from "@/lib/meta/tokens.server";

export type ClientMetaAccount = {
  id: string;
  client_id: string;
  ad_account_id: string | null;
  page_id: string | null;
  ig_account_id: string | null;
  connected: boolean;
  auth_type: string | null;
};

/** Returns the vaulted token + account row for a client, or null when absent. */
export async function getClientMetaToken(
  clientId: string,
): Promise<{ token: string; account: ClientMetaAccount } | null> {
  const { data: account } = await (supabaseAdmin.from("meta_accounts" as any) as any)
    .select("id,client_id,ad_account_id,page_id,ig_account_id,connected,auth_type")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!account?.id) return null;
  const token = await getMetaToken(account.id);
  if (!token) return null;
  return { token, account: account as ClientMetaAccount };
}

/**
 * Same as above but throws a user-facing message, for API routes that cannot
 * do anything useful without a token.
 */
export async function requireClientMetaToken(clientId: string) {
  const found = await getClientMetaToken(clientId);
  if (!found) {
    throw new Error(
      "Este cliente no tiene una cuenta de Meta conectada. Conéctala con OAuth o con un token de System User.",
    );
  }
  return found;
}
