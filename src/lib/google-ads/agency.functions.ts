// Server functions de la conexión única de la agencia (MCC) en Configuración → Google Ads.
// Leer: cualquier miembro de la org. Conectar/cambiar/desconectar: owner o admin.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AgencyGoogleAdsStatus = {
  configured: boolean;
  missing: { name: string; why: string }[];
  orgName: string | null;
  canManage: boolean;
  connection: {
    status: "pendiente" | "conectada" | "error";
    managerCustomerId: string | null;
    managerName: string | null;
    hasToken: boolean;
    lastError: string | null;
    updatedAt: string;
  } | null;
  /** Clientes leídos con la MCC de la agencia / con token propio. */
  linkedViaAgency: number;
  linkedWithOwnToken: number;
};

async function requireOrg(userId: string, manage: boolean) {
  const { getUserOrg, canManageOrg } = await import("@/lib/google-ads/agency.server");
  const org = await getUserOrg(userId);
  if (!org) throw new Error("No perteneces a ninguna organización");
  if (manage && !canManageOrg(org.role)) {
    throw new Error("Solo el dueño o un administrador puede cambiar la conexión de la agencia");
  }
  return org;
}

export const getAgencyGoogleAdsStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgencyGoogleAdsStatus> => {
    const org = await requireOrg(context.userId, false);
    const { missingGoogleAdsVars } = await import("@/lib/google-ads/config.server");
    const { canManageOrg, getAgencyConnection } = await import("@/lib/google-ads/agency.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [conn, accounts] = await Promise.all([
      getAgencyConnection(org.orgId),
      supabaseAdmin
        .from("google_ads_accounts")
        .select("auth_source,token_secret_id")
        .eq("org_id", org.orgId),
    ]);
    if (accounts.error) throw new Error("No se pudieron contar las cuentas vinculadas");
    const rows = accounts.data ?? [];
    const missing = missingGoogleAdsVars();
    return {
      configured: missing.length === 0,
      missing,
      orgName: org.orgName,
      canManage: canManageOrg(org.role),
      connection: conn
        ? {
            status: conn.status,
            managerCustomerId: conn.manager_customer_id,
            managerName: conn.manager_name,
            hasToken: Boolean(conn.token_secret_id),
            lastError: conn.last_error,
            updatedAt: conn.updated_at,
          }
        : null,
      linkedViaAgency: rows.filter((r) => r.auth_source === "agencia").length,
      linkedWithOwnToken: rows.filter((r) => r.auth_source !== "agencia" && r.token_secret_id)
        .length,
    };
  });

/** URL de consentimiento de Google para la MCC de la agencia (state firmado + nonce). */
export const startAgencyGoogleAdsOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const org = await requireOrg(context.userId, true);
    const { requireGoogleAdsConfig, googleRedirectUri, GOOGLE_ADS_SCOPE, GOOGLE_AUTH_URL } =
      await import("@/lib/google-ads/config.server");
    const cfg = requireGoogleAdsConfig();
    const { createOAuthState } = await import("@/lib/oauthState.server");
    const state = await createOAuthState(
      { clientId: org.orgId, userId: context.userId, purpose: "google_ads_agency" },
      cfg.clientSecret,
    );
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: googleRedirectUri(),
      response_type: "code",
      scope: GOOGLE_ADS_SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return { url: `${GOOGLE_AUTH_URL}?${params.toString()}` };
  });

/** MCC accesibles con el token guardado (cuando hay varias y falta elegir). */
export const listAgencyManagers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const org = await requireOrg(context.userId, true);
    const { requireGoogleAdsConfig } = await import("@/lib/google-ads/config.server");
    const { getAgencyConnection, getAgencyRefreshToken, listAccessibleManagers } =
      await import("@/lib/google-ads/agency.server");
    const { refreshAccessToken } = await import("@/lib/google-ads/client.server");
    const cfg = requireGoogleAdsConfig();
    const conn = await getAgencyConnection(org.orgId);
    if (!conn?.token_secret_id)
      throw new Error("Primero conecta la cuenta de Google de la agencia");
    const refreshToken = await getAgencyRefreshToken(org.orgId);
    if (!refreshToken) throw new Error("No hay token guardado. Vuelve a conectar.");
    const accessToken = await refreshAccessToken(cfg, refreshToken);
    return listAccessibleManagers(cfg, accessToken);
  });

/** Elige cuál MCC es la de la agencia (debe ser accesible con el token guardado). */
export const setAgencyManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input as { customerId?: unknown } | null)?.customerId;
    const customerId = typeof raw === "string" ? raw.replace(/-/g, "").trim() : "";
    if (!/^\d{10}$/.test(customerId)) throw new Error("ID de cuenta inválido");
    return { customerId };
  })
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context.userId, true);
    const { requireGoogleAdsConfig } = await import("@/lib/google-ads/config.server");
    const { getAgencyRefreshToken, listAccessibleManagers, saveAgencyConnection } =
      await import("@/lib/google-ads/agency.server");
    const { refreshAccessToken } = await import("@/lib/google-ads/client.server");
    const cfg = requireGoogleAdsConfig();
    const refreshToken = await getAgencyRefreshToken(org.orgId);
    if (!refreshToken) throw new Error("No hay token guardado. Vuelve a conectar.");
    const accessToken = await refreshAccessToken(cfg, refreshToken);
    const { managers } = await listAccessibleManagers(cfg, accessToken);
    const manager = managers.find((m) => m.customerId === data.customerId);
    if (!manager) throw new Error("Esa cuenta no es una MCC accesible con la cuenta conectada");
    await saveAgencyConnection({
      orgId: org.orgId,
      userId: context.userId,
      manager,
      status: "conectada",
    });
    return { ok: true };
  });

/** Borra el token de la agencia; las cuentas vinculadas vía MCC quedan sin acceso. */
export const disconnectAgencyGoogleAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const org = await requireOrg(context.userId, true);
    const { deleteAgencyConnection } = await import("@/lib/google-ads/agency.server");
    await deleteAgencyConnection(org.orgId);
    return { ok: true };
  });
