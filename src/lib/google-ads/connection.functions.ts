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

export type GoogleAdsConnectionView = {
  customerId: string;
  managerCustomerId: string | null;
  status: "pendiente" | "conectada" | "error" | "desconectada";
  hasToken: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

export type GoogleAdsOverview = {
  configured: boolean;
  missing: { name: string; why: string }[];
  connection: GoogleAdsConnectionView | null;
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

/** Estado de configuración (qué variables faltan) y de la conexión del cliente. */
export const getGoogleAdsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateClientInput)
  .handler(async ({ data, context }): Promise<GoogleAdsOverview> => {
    const { missingGoogleAdsVars } = await import("@/lib/google-ads/config.server");
    const missing = missingGoogleAdsVars();
    // Con la sesión del usuario: RLS decide si puede ver la conexión.
    const { data: row, error } = await context.supabase
      .from("google_ads_accounts")
      .select(
        "customer_id,manager_customer_id,status,token_secret_id,last_synced_at,last_sync_error",
      )
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (error) throw new Error("No se pudo leer la conexión de Google Ads");
    return {
      configured: missing.length === 0,
      missing,
      connection: row
        ? {
            customerId: row.customer_id,
            managerCustomerId: row.manager_customer_id,
            status: row.status as GoogleAdsConnectionView["status"],
            hasToken: Boolean(row.token_secret_id),
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

async function discoverForAccount(accountId: string) {
  const { requireGoogleAdsConfig } = await import("@/lib/google-ads/config.server");
  const { getGoogleAdsRefreshToken } = await import("@/lib/google-ads/tokens.server");
  const { refreshAccessToken } = await import("@/lib/google-ads/client.server");
  const { discoverCustomers } = await import("@/lib/google-ads/accounts.server");
  const cfg = requireGoogleAdsConfig();
  const refreshToken = await getGoogleAdsRefreshToken(accountId);
  if (!refreshToken) throw new Error("No hay token guardado. Vuelve a conectar Google Ads.");
  const accessToken = await refreshAccessToken(cfg, refreshToken);
  return discoverCustomers(cfg, accessToken);
}

/** Cuentas que puede elegir este cliente (marcando las ya vinculadas a otros). */
export const listGoogleAdsCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateClientInput)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ customers: GoogleAdsCustomerChoice[]; warnings: string[] }> => {
      const account = await loadAuthorizedAccount(context.userId, data.clientId);
      const { getTakenCustomers } = await import("@/lib/google-ads/connection.server");
      const [{ options, errors }, taken] = await Promise.all([
        discoverForAccount(account.id),
        getTakenCustomers(data.clientId, account.org_id),
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
      };
    },
  );

/** Vincula la cuenta elegida y trae el último mes de métricas. */
export const linkGoogleAdsCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const { clientId } = validateClientInput(input);
    const raw = (input as { customerId?: unknown }).customerId;
    const customerId = typeof raw === "string" ? raw.replace(/-/g, "").trim() : "";
    if (!/^\d{10}$/.test(customerId)) throw new Error("ID de cuenta inválido");
    return { clientId, customerId };
  })
  .handler(async ({ data, context }) => {
    const account = await loadAuthorizedAccount(context.userId, data.clientId);
    const { getTakenCustomers, saveConnection } =
      await import("@/lib/google-ads/connection.server");
    const { isLinkable } = await import("@/lib/google-ads/gaql");

    // No se confía en el navegador: la cuenta debe ser accesible con el token guardado.
    const [{ options }, taken] = await Promise.all([
      discoverForAccount(account.id),
      getTakenCustomers(data.clientId, account.org_id),
    ]);
    const option = options.find((o) => o.customerId === data.customerId);
    if (!option) throw new Error("Esa cuenta no es accesible con la cuenta de Google conectada");
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
      orgId: account.org_id,
      option,
      status: "conectada",
    });
    const { ingestAccount, BACKFILL_DAYS } = await import("@/lib/google-ads/ingest.server");
    const sync = await ingestAccount(saved, BACKFILL_DAYS);
    return { ok: true, rows: sync.rows, syncError: sync.error ?? null };
  });

/** Re-descarga el último mes para este cliente (botón "Actualizar ahora"). */
export const syncGoogleAdsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateClientInput)
  .handler(async ({ data, context }) => {
    const account = await loadAuthorizedAccount(context.userId, data.clientId);
    if (account.status !== "conectada") throw new Error("Primero elige la cuenta de Google Ads");
    const { ingestAccount, BACKFILL_DAYS } = await import("@/lib/google-ads/ingest.server");
    const sync = await ingestAccount(account, BACKFILL_DAYS);
    if (sync.error) throw new Error(sync.error);
    return { rows: sync.rows };
  });

/** Borra el token de Vault y la conexión; las métricas ya descargadas se conservan. */
export const disconnectGoogleAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateClientInput)
  .handler(async ({ data, context }) => {
    const account = await loadAuthorizedAccount(context.userId, data.clientId);
    const { deleteConnection } = await import("@/lib/google-ads/connection.server");
    await deleteConnection(account.id);
    return { ok: true };
  });
