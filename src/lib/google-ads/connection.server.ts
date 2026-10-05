// Persistencia de la conexión Google Ads ↔ cliente (service role, después de
// verificar permisos en quien llama). El refresh token solo va a Vault.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { setGoogleAdsRefreshToken } from "@/lib/google-ads/tokens.server";
import type { CustomerOption } from "@/lib/google-ads/gaql";

export type GoogleAdsStatus = "pendiente" | "conectada" | "error" | "desconectada";

export type GoogleAdsAccountRow = {
  id: string;
  client_id: string;
  org_id: string;
  customer_id: string;
  manager_customer_id: string | null;
  status: GoogleAdsStatus;
  token_secret_id: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
};

const ACCOUNT_COLUMNS =
  "id,client_id,org_id,customer_id,manager_customer_id,status,token_secret_id,last_synced_at,last_sync_error";

export async function getClientOrgId(clientId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("org_id")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer el cliente");
  const orgId = (data as { org_id?: string } | null)?.org_id;
  if (!orgId) throw new Error("Cliente no encontrado");
  return orgId;
}

export async function getAccountByClient(clientId: string): Promise<GoogleAdsAccountRow | null> {
  const { data, error } = await supabaseAdmin
    .from("google_ads_accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer la conexión de Google Ads");
  return (data as GoogleAdsAccountRow | null) ?? null;
}

/**
 * Cuentas de Google Ads vinculadas a OTROS clientes (customer_id es único en
 * toda la base). Solo se muestra el nombre si el cliente es de la misma org.
 */
export async function getTakenCustomers(
  clientId: string,
  orgId: string,
): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin
    .from("google_ads_accounts")
    .select("customer_id,org_id,clients(name)")
    .neq("client_id", clientId);
  if (error) throw new Error("No se pudo revisar qué cuentas ya están vinculadas");
  const taken = new Map<string, string>();
  type TakenRow = { customer_id: string; org_id: string; clients: { name: string | null } | null };
  for (const r of (data ?? []) as unknown as TakenRow[]) {
    const label = r.org_id === orgId ? (r.clients?.name ?? "otro cliente") : "otra organización";
    taken.set(String(r.customer_id), label);
  }
  return taken;
}

function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === "23505";
}

/** Crea o actualiza la conexión del cliente y guarda el refresh token en Vault. */
export async function saveConnection(input: {
  clientId: string;
  orgId: string;
  option: CustomerOption;
  status: GoogleAdsStatus;
  refreshToken?: string;
}): Promise<GoogleAdsAccountRow> {
  const { data, error } = await supabaseAdmin
    .from("google_ads_accounts")
    .upsert(
      {
        client_id: input.clientId,
        org_id: input.orgId,
        customer_id: input.option.customerId,
        manager_customer_id: input.option.managerId,
        status: input.status,
        last_sync_error: null,
      },
      { onConflict: "client_id" },
    )
    .select(ACCOUNT_COLUMNS)
    .single();
  if (isUniqueViolation(error)) {
    throw new Error("Esa cuenta de Google Ads ya está vinculada a otro cliente.");
  }
  if (error || !data) throw new Error("No se pudo guardar la conexión de Google Ads");
  if (input.refreshToken)
    await setGoogleAdsRefreshToken((data as GoogleAdsAccountRow).id, input.refreshToken);
  return data as GoogleAdsAccountRow;
}

/** Borra el token de Vault y la conexión. Las métricas descargadas se conservan. */
export async function deleteConnection(accountId: string): Promise<void> {
  await setGoogleAdsRefreshToken(accountId, null);
  const { error } = await supabaseAdmin.from("google_ads_accounts").delete().eq("id", accountId);
  if (error) throw new Error("No se pudo desconectar Google Ads");
}

export async function markSyncResult(
  accountId: string,
  result: { ok: true } | { ok: false; message: string; needsReconnect: boolean },
): Promise<void> {
  const patch = result.ok
    ? {
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
        status: "conectada" as const,
      }
    : {
        last_sync_error: result.message.slice(0, 500),
        ...(result.needsReconnect ? { status: "error" as const } : {}),
      };
  const { error } = await supabaseAdmin
    .from("google_ads_accounts")
    .update(patch)
    .eq("id", accountId);
  if (error)
    console.error("[google-ads] no se pudo guardar el resultado de la sync", error.message);
}
