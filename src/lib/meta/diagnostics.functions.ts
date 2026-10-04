import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MetaEnvStatus = {
  META_APP_ID: boolean;
  META_APP_SECRET: boolean;
  PUBLIC_SITE_URL: boolean;
  DISPATCH_SECRET: boolean;
  META_GRAPH_VERSION: string;
  redirectUri: string | null;
  redirectUriError: string | null;
};

export type MetaAccountDiag = {
  accountId: string;
  clientId: string;
  clientName: string | null;
  adAccountId: string | null;
  requestedScopes: string[];
  grantedScopes: string[];
  missingScopes: string[];
  tokenValid: boolean | null;
  tokenExpiresAt: string | null;
  tokenError: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

export const getMetaDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { META_SCOPES, redirectUri } = await import("@/lib/meta/oauth.server");
    const { metaGraphVersion, graphUrl } = await import("@/lib/meta/version");
    const { getMetaToken } = await import("@/lib/meta/tokens.server");

    let uri: string | null = null;
    let uriError: string | null = null;
    try {
      uri = redirectUri();
    } catch (e: any) {
      uriError = e?.message ?? "PUBLIC_SITE_URL no configurada";
    }

    const env: MetaEnvStatus = {
      META_APP_ID: !!process.env.META_APP_ID,
      META_APP_SECRET: !!process.env.META_APP_SECRET,
      PUBLIC_SITE_URL: !!process.env.PUBLIC_SITE_URL,
      DISPATCH_SECRET: !!process.env.DISPATCH_SECRET,
      META_GRAPH_VERSION: metaGraphVersion(),
      redirectUri: uri,
      redirectUriError: uriError,
    };

    const { data: rows } = await (context.supabase.from("meta_accounts" as any) as any)
      .select(
        "id,client_id,ad_account_id,scopes,connected,token_expires_at,last_synced_at,last_sync_error,clients(name)",
      )
      .eq("connected", true);

    const appToken =
      process.env.META_APP_ID && process.env.META_APP_SECRET
        ? `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
        : null;

    const accounts: MetaAccountDiag[] = [];
    for (const row of (rows ?? []) as any[]) {
      const requested = [...META_SCOPES];
      const diag: MetaAccountDiag = {
        accountId: row.id,
        clientId: row.client_id,
        clientName: row.clients?.name ?? null,
        adAccountId: row.ad_account_id ?? null,
        requestedScopes: requested,
        grantedScopes: (row.scopes ?? []) as string[],
        missingScopes: [],
        tokenValid: null,
        tokenExpiresAt: row.token_expires_at ?? null,
        tokenError: null,
        lastSyncedAt: row.last_synced_at ?? null,
        lastSyncError: row.last_sync_error ?? null,
      };

      const token = await getMetaToken(row.id);
      if (!token) {
        diag.tokenValid = false;
        diag.tokenError = "No hay token guardado";
      } else if (!appToken) {
        diag.tokenError = "Falta META_APP_ID / META_APP_SECRET para validar";
      } else {
        try {
          const res = await fetch(
            `${graphUrl("debug_token")}?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`,
          );
          const body: any = await res.json();
          const d = body?.data;
          if (!res.ok || !d) {
            diag.tokenValid = false;
            diag.tokenError = body?.error?.message ?? "Meta no devolvió datos del token";
          } else {
            diag.tokenValid = !!d.is_valid;
            diag.grantedScopes = (d.scopes ?? diag.grantedScopes) as string[];
            diag.tokenExpiresAt = d.expires_at
              ? new Date(d.expires_at * 1000).toISOString()
              : diag.tokenExpiresAt;
            if (d.error?.message) diag.tokenError = d.error.message;
          }
        } catch (e: any) {
          diag.tokenValid = false;
          diag.tokenError = e?.message ?? "Error al consultar debug_token";
        }
      }

      diag.missingScopes = diag.requestedScopes.filter((s) => !diag.grantedScopes.includes(s));
      accounts.push(diag);
    }

    return { env, accounts };
  });

/** Runs ingestion for one account/date and returns the raw result for inspection. */
export const testMetaIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; date?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: owned } = await (context.supabase.from("meta_accounts" as any) as any)
      .select("id,client_id,ad_account_id,ig_account_id,connected,timezone_name")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a esta conexión");
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, owned.client_id);

    const { getMetaToken } = await import("@/lib/meta/tokens.server");
    const token = await getMetaToken(data.accountId);
    if (!token) throw new Error("No hay token de Meta guardado");

    const { ingestAccountDay } = await import("@/lib/meta/insights.server");
    return await ingestAccountDay(owned as any, token, data.date ?? undefined, 1);
  });

/**
 * Full connection probe: returns every raw Meta payload of the async insights
 * job (report_run_id, async_status polls, error objects) with no friendly
 * message in between, so a silent ingestion failure can be diagnosed.
 */
export const debugMetaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; date?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: owned } = await (context.supabase.from("meta_accounts" as any) as any)
      .select("id,client_id,ad_account_id,ig_account_id,connected,timezone_name")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a esta conexión");
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, owned.client_id);

    const { getMetaToken } = await import("@/lib/meta/tokens.server");
    const token = await getMetaToken(data.accountId);
    if (!token) throw new Error("No hay token de Meta guardado");

    if (!owned.ad_account_id) {
      return {
        account: owned,
        insights: null,
        note: "La conexión no tiene cuenta publicitaria asignada, por eso nunca escribe filas en ad_insights_daily.",
      };
    }

    const { yesterdayISO } = await import("@/lib/meta/insights.server");
    const { debugAdInsightsRun } = await import("@/lib/meta/insightsDebug.server");
    const insights = await debugAdInsightsRun({
      adAccountId: owned.ad_account_id,
      token,
      until: data.date ?? yesterdayISO(owned.timezone_name),
      windowDays: 7,
    });

    return { account: owned, insights, note: null };
  });
