// Refresh tokens de Google Ads: viven cifrados en Supabase Vault; la tabla
// google_ads_accounts solo guarda la referencia (token_secret_id).
// google_ads_get_secret / google_ads_set_secret solo los ejecuta service_role.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getGoogleAdsRefreshToken(accountId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("google_ads_get_secret", {
    _account_id: accountId,
  });
  if (error) {
    console.error("[google-ads] google_ads_get_secret failed", error.message);
    return null;
  }
  const value = typeof data === "string" ? data.trim() : "";
  return value.length > 0 ? value : null;
}

/** Guarda (o borra con null) el refresh token en Vault. */
export async function setGoogleAdsRefreshToken(
  accountId: string,
  token: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin.rpc("google_ads_set_secret", {
    _account_id: accountId,
    _secret: token as string,
  });
  if (error) throw new Error(error.message);
}
