// Server functions de Google Ads para la pantalla del cliente.
// Toda acción que use el token de la agencia exige rol de edición en la org.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateClientInput(input: unknown): { clientId: string } {
  const clientId = (input as { clientId?: unknown } | null)?.clientId;
  if (typeof clientId !== "string" || !UUID_RE.test(clientId)) throw new Error("Cliente inválido");
  return { clientId };
}

/** De dónde salen las cuentas a elegir: token propio del cliente o MCC de la agencia. */
export type CustomerSource = "cliente" | "agencia";

function validatePickInput(input: unknown): { clientId: string; source: CustomerSource | null } {
  const { clientId } = validateClientInput(input);
  const raw = (input as { source?: unknown }).source;
  if (raw !== undefined && raw !== null && raw !== "cliente" && raw !== "agencia") {
    throw new Error("Origen inválido");
  }
  return { clientId, source: (raw as CustomerSource | undefined) ?? null };
}

export type GoogleAdsConnectionView = {
  customerId: string;
  managerCustomerId: string | null;
  status: "pendiente" | "conectada" | "error" | "desconectada";
  hasToken: boolean;
  authSource: CustomerSource;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

export type GoogleAdsOverview = {
  configured: boolean;
  missing: { name: string; why: string }[];
  connection: GoogleAdsConnectionView | null;
  /** MCC de la agencia lista para vincular clientes (Configuración → Google Ads). */
  agency: { managerCustomerId: string; managerName: string | null } | null;
};

export type GoogleAdsCustomerChoice = {
  customerId: string;
  name: string | null;
  managerId: string | null;
  isManager: boolean;
  currency: string | null;
  /** Nombre del cliente que ya la tiene vinculada (o "otra organización"). */
  takenBy: string | null;
};

/** Estado de configuración, conexión del cliente y MCC de la agencia. */
export const getGoogleAdsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateClientInput)
  .handler(async ({ data, context }): Promise<GoogleAdsOverview> => {
    const { missingGoogleAdsVars } = await import("@/lib/google-ads/config.server");
    const { isAgencyReady } = await import("@/lib/google-ads/agency");
    const missing = missingGoogleAdsVars();
    // Con la sesión del usuario: RLS decide qué puede ver.
    const accountRes = await context.supabase
      .from("google_ads_accounts")
      .select(
        "org_id,customer_id,manager_customer_id,status,token_secret_id,auth_source,last_synced_at,last_sync_error",
      )
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (accountRes.error) throw new Error("No se pudo leer la conexión de Google Ads");
    const row = accountRes.data;

    // MCC de la agencia: la org del cliente (RLS: miembros de la org la ven).
    const { data: client } = await context.supabase
      .from("clients")
      .select("org_id")
      .eq("id", data.clientId)
      .maybeSingle();
    const orgId = row?.org_id ?? client?.org_id ?? null;
    const { data: agencyRow } = orgId
      ? await context.supabase
          .from("google_ads_agency_connection")
          .select("status,manager_customer_id,manager_name,token_secret_id")
          .eq("org_id", orgId)
          .maybeSingle()
      : { data: null };
    const agencyReady = isAgencyReady(agencyRow ?? null);
    const authSource: CustomerSource = row?.auth_source === "agencia" ? "agencia" : "cliente";

    return {
      configured: missing.length === 0,
      missing,
      agency:
        agencyReady && agencyRow?.manager_customer_id
          ? {
              managerCustomerId: agencyRow.manager_customer_id,
              managerName: agencyRow.manager_name,
            }
          : null,
      connection: row
        ? {
            customerId: row.customer_id,
            managerCustomerId: row.manager_customer_id,
            status: row.status as GoogleAdsConnectionView["status"],
            hasToken: authSource === "agencia" ? agencyReady : Boolean(row.token_secret_id),
            authSource,
            lastSyncedAt: row.last_synced_at,
            lastSyncError: row.last_sync_error,
          }
        : null,
    };
  });

/** URL de consentimiento de Google (scope adwords, offline + prompt=consent). */
export const startGoogleAdsOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateClientInput)
  .handler(async ({ data, context }) => {
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, data.clientId);

    const { requireGoogleAdsConfig, googleRedirectUri, GOOGLE_ADS_SCOPE, GOOGLE_AUTH_URL } =
      await import("@/lib/google-ads/config.server");
    const cfg = requireGoogleAdsConfig();
    // State firmado + nonce en cookie HttpOnly: el callback exige el mismo navegador.
    const { createOAuthState } = await import("@/lib/oauthState.server");
    const state = await createOAuthState(
      { clientId: data.clientId, userId: context.userId, purpose: "google_ads" },
      cfg.clientSecret,
    );
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: googleRedirectUri(),
      response_type: "code",
      scope: GOOGLE_ADS_SCOPE,
      // offline + consent: Google entrega refresh_token también al reconectar.
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return { url: `${GOOGLE_AUTH_URL}?${params.toString()}` };
  });

async function loadAuthorizedAccount(userId: string, clientId: string) {
  const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
  await assertCanEditClient(userId, clientId);
  const { getAccountByClient } = await import("@/lib/google-ads/connection.server");
  const account = await getAccountByClient(clientId);
  if (!account) throw new Error("Primero conecta una cuenta de Google");
  return account;
}

/**
 * Origen de las cuentas a elegir. Por defecto: el token propio si el cliente
 * lo tiene (compatibilidad); si no, la MCC de la agencia.
 */
async function resolvePickContext(userId: string, clientId: string, wanted: CustomerSource | null) {
  const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
  await assertCanEditClient(userId, clientId);
  const { getAccountByClient, getClientOrgId } = await import("@/lib/google-ads/connection.server");
  const account = await getAccountByClient(clientId);
  const orgId = account?.org_id ?? (await getClientOrgId(clientId));
  const ownTokenAvailable = Boolean(account?.token_secret_id && account.auth_source !== "agencia");
  const source: CustomerSource = wanted ?? (ownTokenAvailable ? "cliente" : "agencia");
  if (source === "cliente" && !ownTokenAvailable) {
    throw new Error("Este cliente no tiene una cuenta de Google propia conectada");
  }
  return { account, orgId, source };
}

async function discoverForSource(
  source: CustomerSource,
  orgId: string,
  accountId: string | null,
): Promise<{ options: import("@/lib/google-ads/gaql").CustomerOption[]; errors: string[] }> {
  const { requireGoogleAdsConfig } = await import("@/lib/google-ads/config.server");
  const cfg = requireGoogleAdsConfig();
  if (source === "agencia") {
    const { discoverAgencyCustomers, getAgencyConnection } =
      await import("@/lib/google-ads/agency.server");
    const options = await discoverAgencyCustomers(cfg, await getAgencyConnection(orgId));
    return { options, errors: [] };
  }
  const { getGoogleAdsRefreshToken } = await import("@/lib/google-ads/tokens.server");
  const { refreshAccessToken } = await import("@/lib/google-ads/client.server");
  const { discoverCustomers } = await import("@/lib/google-ads/accounts.server");
  const refreshToken = accountId ? await getGoogleAdsRefreshToken(accountId) : null;
  if (!refreshToken) throw new Error("No hay token guardado. Vuelve a conectar Google Ads.");
  const accessToken = await refreshAccessToken(cfg, refreshToken);
  return discoverCustomers(cfg, accessToken);
}

/** Cuentas que puede elegir este cliente (marcando las ya vinculadas a otros). */
export const listGoogleAdsCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validatePickInput)
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      customers: GoogleAdsCustomerChoice[];
      warnings: string[];
      source: CustomerSource;
    }> => {
      const { account, orgId, source } = await resolvePickContext(
        context.userId,
        data.clientId,
        data.source,
      );
      const { getTakenCustomers } = await import("@/lib/google-ads/connection.server");
      const [{ options, errors }, taken] = await Promise.all([
        discoverForSource(source, orgId, account?.id ?? null),
        getTakenCustomers(data.clientId, orgId),
      ]);
      return {
        customers: options.map((o) => ({
          customerId: o.customerId,
          name: o.name,
          managerId: o.managerId,
          isManager: o.isManager,
          currency: o.currency,
          takenBy: taken.get(o.customerId) ?? null,
        })),
        warnings: errors,
        source,
      };
    },
  );

/** Vincula la cuenta elegida, trae el último mes y revisa la facturación. */
export const linkGoogleAdsCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const { clientId, source } = validatePickInput(input);
    const raw = (input as { customerId?: unknown }).customerId;
    const customerId = typeof raw === "string" ? raw.replace(/-/g, "").trim() : "";
    if (!/^\d{10}$/.test(customerId)) throw new Error("ID de cuenta inválido");
    return { clientId, customerId, source };
  })
  .handler(async ({ data, context }) => {
    const { account, orgId, source } = await resolvePickContext(
      context.userId,
      data.clientId,
      data.source,
    );
    const { getTakenCustomers, saveConnection } =
      await import("@/lib/google-ads/connection.server");

    // No se confía en el navegador: la cuenta debe ser accesible con el token elegido.
    const [{ options }, taken] = await Promise.all([
      discoverForSource(source, orgId, account?.id ?? null),
      getTakenCustomers(data.clientId, orgId),
    ]);
    const option = options.find((o) => o.customerId === data.customerId);
    if (!option) {
      throw new Error(
        source === "agencia"
          ? "Esa cuenta no está bajo la MCC de la agencia"
          : "Esa cuenta no es accesible con la cuenta de Google conectada",
      );
    }
    if (option.isManager)
      throw new Error("Elige una cuenta de anuncios, no una cuenta administradora (MCC)");
    if (option.currency !== "CLP") {
      throw new Error(
        `La cuenta factura en ${option.currency ?? "otra moneda"}; la plataforma trabaja solo en CLP`,
      );
    }
    const takenBy = taken.get(option.customerId);
    if (takenBy)
      throw new Error(`Esa cuenta ya está vinculada a ${takenBy}. Desvincúlala allí primero.`);

    const saved = await saveConnection({
      clientId: data.clientId,
      orgId,
      option,
      status: "conectada",
      authSource: source,
    });
    const { requireGoogleAdsConfig } = await import("@/lib/google-ads/config.server");
    const cfg = requireGoogleAdsConfig();
    const { ingestAccount, BACKFILL_DAYS } = await import("@/lib/google-ads/ingest.server");
    const { checkClientBillingNow } = await import("@/lib/google-ads/billing.server");
    const sync = await ingestAccount(saved, BACKFILL_DAYS, cfg);
    const billing = await checkClientBillingNow(saved, cfg);
    return {
      ok: true,
      rows: sync.rows,
      syncError: sync.error ?? null,
      billingVerdict: billing.verdict,
    };
  });

/** Re-descarga el último mes para este cliente (botón "Actualizar ahora"). */
export const syncGoogleAdsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateClientInput)
  .handler(async ({ data, context }) => {
    const account = await loadAuthorizedAccount(context.userId, data.clientId);
    if (account.status !== "conectada") throw new Error("Primero elige la cuenta de Google Ads");
    const { requireGoogleAdsConfig } = await import("@/lib/google-ads/config.server");
    const cfg = requireGoogleAdsConfig();
    const { ingestAccount, BACKFILL_DAYS } = await import("@/lib/google-ads/ingest.server");
    const { checkClientBillingNow } = await import("@/lib/google-ads/billing.server");
    const sync = await ingestAccount(account, BACKFILL_DAYS, cfg);
    if (sync.error) throw new Error(sync.error);
    // También refresca el estado de facturación (chip y alerta).
    const billing = await checkClientBillingNow(account, cfg);
    return { rows: sync.rows, billingError: billing.error ?? null };
  });

/** Borra el token de Vault y la conexión; las métricas ya descargadas se conservan. */
export const disconnectGoogleAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateClientInput)
  .handler(async ({ data, context }) => {
    const account = await loadAuthorizedAccount(context.userId, data.clientId);
    const { deleteConnection } = await import("@/lib/google-ads/connection.server");
    await deleteConnection(account.id, account.client_id);
    return { ok: true };
  });
