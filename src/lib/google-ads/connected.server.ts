/** Cuántas cuentas de Google Ads están en estado 'conectada' (service role). */
export async function countConnectedGoogleAdsAccounts(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("google_ads_accounts")
    .select("id", { count: "exact", head: true })
    .eq("status", "conectada");
  if (error) throw new Error(`No se pudieron contar las cuentas de Google Ads: ${error.message}`);
  return count ?? 0;
}
