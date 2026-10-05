// Conexión única de la agencia (MCC): persistencia (service role) y acceso a la API.
// El refresh token vive solo en Vault (google_ads_agency_get/set_secret).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { GoogleAdsConfig } from "@/lib/google-ads/config.server";
import {
  GoogleAdsError,
  listAccessibleCustomers,
  refreshAccessToken,
  searchStream,
} from "@/lib/google-ads/client.server";
import { parseCustomerClients, type CustomerOption } from "@/lib/google-ads/gaql";
import {
  AGENCY_HIERARCHY_QUERY,
  MANAGER_CHECK_QUERY,
  isAgencyReady,
  parseManagerCandidate,
  resolveAuthPlan,
  type AuthSource,
  type ManagerCandidate,
} from "@/lib/google-ads/agency";
import { getGoogleAdsRefreshToken } from "@/lib/google-ads/tokens.server";

export type AgencyStatus = "pendiente" | "conectada" | "error";

export type AgencyConnectionRow = {
  id: string;
  org_id: string;
  manager_customer_id: string | null;
  manager_name: string | null;
  token_secret_id: string | null;
  connected_by: string | null;
  status: AgencyStatus;
  last_error: string | null;
  updated_at: string;
};

const AGENCY_COLUMNS =
  "id,org_id,manager_customer_id,manager_name,token_secret_id,connected_by,status,last_error,updated_at";

/** Tope de cuentas raíz a revisar al buscar MCC (subrequests del Worker). */
const MAX_MANAGER_ROOTS = 15;

export type UserOrg = { orgId: string; orgName: string | null; role: string };

/** Org del usuario (la más antigua, igual que org_meta_token_status). */
export async function getUserOrg(userId: string): Promise<UserOrg | null> {
  const { data, error } = await supabaseAdmin
    .from("org_members")
    .select("org_id,role,orgs(name,created_at)")
    .eq("user_id", userId);
  if (error) throw new Error("No se pudo leer tu organización");
  type Row = { org_id: string; role: string; orgs: { name: string | null; created_at: string } };
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.orgs);
  if (rows.length === 0) return null;
  const first = [...rows].sort((a, b) => a.orgs.created_at.localeCompare(b.orgs.created_at))[0];
  return { orgId: first.org_id, orgName: first.orgs.name, role: first.role };
}

export function canManageOrg(role: string): boolean {
  return role === "owner" || role === "admin";
}

export async function getAgencyConnection(orgId: string): Promise<AgencyConnectionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("google_ads_agency_connection")
    .select(AGENCY_COLUMNS)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer la conexión de Google Ads de la agencia");
  return (data as AgencyConnectionRow | null) ?? null;
}

export async function getAgencyRefreshToken(orgId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("google_ads_agency_get_secret", {
    _org_id: orgId,
  });
  if (error) {
    console.error("[google-ads agency] google_ads_agency_get_secret falló", error.message);
    return null;
  }
  const value = typeof data === "string" ? data.trim() : "";
  return value.length > 0 ? value : null;
}

/** Crea/actualiza la conexión de la org y guarda el refresh token (si viene) en Vault. */
export async function saveAgencyConnection(input: {
  orgId: string;
  userId: string;
  manager: ManagerCandidate | null;
  status: AgencyStatus;
  refreshToken?: string;
}): Promise<AgencyConnectionRow> {
  const { data, error } = await supabaseAdmin
    .from("google_ads_agency_connection")
    .upsert(
      {
        org_id: input.orgId,
        manager_customer_id: input.manager?.customerId ?? null,
        manager_name: input.manager?.name ?? null,
        connected_by: input.userId,
        status: input.status,
        last_error: null,
      },
      { onConflict: "org_id" },
    )
    .select(AGENCY_COLUMNS)
    .single();
  if (error || !data) throw new Error("No se pudo guardar la conexión de la agencia");
  if (input.refreshToken) {
    const { error: sErr } = await supabaseAdmin.rpc("google_ads_agency_set_secret", {
      _org_id: input.orgId,
      _secret: input.refreshToken,
    });
    if (sErr) {
      console.error("[google-ads agency] google_ads_agency_set_secret falló", sErr.message);
      await markAgencyError(input.orgId, "No se pudo guardar el acceso. Vuelve a conectar.");
      throw new Error("No se pudo guardar el token de la agencia en Vault");
    }
  }
  return data as AgencyConnectionRow;
}

export async function markAgencyError(orgId: string, message: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("google_ads_agency_connection")
    .update({ status: "error", last_error: message.slice(0, 500) })
    .eq("org_id", orgId);
  if (error) console.error("[google-ads agency] no se pudo marcar el error", error.message);
}

/**
 * Borra el token de Vault y la conexión de la agencia. Las cuentas de clientes
 * vinculadas vía agencia quedan sin acceso (status 'error') hasta reconectar.
 */
export async function deleteAgencyConnection(orgId: string): Promise<void> {
  const { error: sErr } = await supabaseAdmin.rpc("google_ads_agency_set_secret", {
    _org_id: orgId,
    _secret: null as unknown as string,
  });
  if (sErr) throw new Error("No se pudo borrar el token de la agencia");
  const { error } = await supabaseAdmin
    .from("google_ads_agency_connection")
    .delete()
    .eq("org_id", orgId);
  if (error) throw new Error("No se pudo desconectar la cuenta administradora");
  const { error: aErr } = await supabaseAdmin
    .from("google_ads_accounts")
    .update({
      status: "error",
      last_sync_error: "Se desconectó la cuenta administradora (MCC) de la agencia.",
    })
    .eq("org_id", orgId)
    .eq("auth_source", "agencia");
  if (aErr) console.error("[google-ads agency] no se pudieron marcar las cuentas", aErr.message);
}

/** MCC a las que la cuenta de Google autorizada accede directamente. */
export async function listAccessibleManagers(
  cfg: GoogleAdsConfig,
  accessToken: string,
): Promise<{ managers: ManagerCandidate[]; errors: string[] }> {
  const accessible = (await listAccessibleCustomers(cfg, accessToken)).slice(0, MAX_MANAGER_ROOTS);
  const errors: string[] = [];
  const found = await Promise.all(
    accessible.map(async (id) => {
      try {
        const body = await searchStream(cfg, accessToken, id, MANAGER_CHECK_QUERY, null);
        return parseManagerCandidate(body);
      } catch (e) {
        errors.push(`${id}: ${(e as Error).message}`);
        return null;
      }
    }),
  );
  return { managers: found.filter((m): m is ManagerCandidate => Boolean(m)), errors };
}

/** Token de acceso de la agencia (falla si no está lista). */
export async function agencyAccessToken(
  cfg: GoogleAdsConfig,
  agency: AgencyConnectionRow | null,
): Promise<{ accessToken: string; managerId: string }> {
  if (!agency || !agency.token_secret_id) {
    throw new GoogleAdsError(
      "La agencia no tiene conectada su cuenta administradora (MCC).",
      401,
      true,
    );
  }
  const refreshToken = await getAgencyRefreshToken(agency.org_id);
  if (!refreshToken) {
    throw new GoogleAdsError("No hay token de la agencia guardado. Reconecta la MCC.", 401, true);
  }
  const accessToken = await refreshAccessToken(cfg, refreshToken);
  return { accessToken, managerId: agency.manager_customer_id ?? "" };
}

/** Cuentas de anuncios bajo la MCC de la agencia (toda la jerarquía). */
export async function discoverAgencyCustomers(
  cfg: GoogleAdsConfig,
  agency: AgencyConnectionRow | null,
): Promise<CustomerOption[]> {
  if (!isAgencyReady(agency)) {
    throw new Error("Primero conecta la cuenta administradora (MCC) en Configuración → Google Ads");
  }
  const { accessToken, managerId } = await agencyAccessToken(cfg, agency);
  const body = await searchStream(cfg, accessToken, managerId, AGENCY_HIERARCHY_QUERY, managerId);
  return parseCustomerClients(managerId, body)
    .filter((o) => o.customerId !== managerId)
    .map((o) => ({ ...o, managerId }))
    .sort(
      (a, b) =>
        Number(a.isManager) - Number(b.isManager) || (a.name ?? "").localeCompare(b.name ?? ""),
    );
}

export type AccountAccess = {
  accessToken: string;
  loginCustomerId: string | null;
  source: AuthSource;
};

/** Cache por lote: una lectura de la conexión y un access token por org. */
export type AccessCache = {
  agencies: Map<string, AgencyConnectionRow | null>;
  tokens: Map<string, Promise<{ accessToken: string; managerId: string }>>;
};

export function newAccessCache(): AccessCache {
  return { agencies: new Map(), tokens: new Map() };
}

async function cachedAgency(orgId: string, cache: AccessCache) {
  if (!cache.agencies.has(orgId)) cache.agencies.set(orgId, await getAgencyConnection(orgId));
  return cache.agencies.get(orgId) ?? null;
}

/**
 * Token y login-customer-id para leer una cuenta vinculada: el propio del
 * cliente (compatibilidad) o el de la MCC de la agencia.
 */
export async function getAccessForAccount(
  cfg: GoogleAdsConfig,
  account: {
    id: string;
    org_id: string;
    auth_source: string | null;
    token_secret_id: string | null;
    manager_customer_id: string | null;
  },
  cache: AccessCache = newAccessCache(),
): Promise<AccountAccess> {
  const agency =
    account.auth_source === "agencia" ? await cachedAgency(account.org_id, cache) : null;
  const plan = resolveAuthPlan(account, agency);
  if ("error" in plan) throw new GoogleAdsError(plan.error, 401, plan.needsReconnect);
  if (plan.source === "agencia") {
    let pending = cache.tokens.get(account.org_id);
    if (!pending) {
      pending = agencyAccessToken(cfg, agency);
      cache.tokens.set(account.org_id, pending);
      // Si falla, el siguiente intento del lote vuelve a pedirlo.
      pending.catch(() => cache.tokens.delete(account.org_id));
    }
    const { accessToken } = await pending;
    return { accessToken, loginCustomerId: plan.loginCustomerId, source: "agencia" };
  }
  const refreshToken = await getGoogleAdsRefreshToken(account.id);
  if (!refreshToken) {
    throw new GoogleAdsError("No hay token guardado. Vuelve a conectar Google Ads.", 401, true);
  }
  const accessToken = await refreshAccessToken(cfg, refreshToken);
  return { accessToken, loginCustomerId: plan.loginCustomerId, source: "cliente" };
}
