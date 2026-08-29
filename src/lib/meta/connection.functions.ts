import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MetaConnection = {
  id: string;
  client_id: string;
  ad_account_id: string | null;
  page_id: string | null;
  ig_account_id: string | null;
  business_name: string | null;
  scopes: string[];
  connected: boolean;
  token_expires_at: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
};

/** Builds the Meta login URL with a signed state carrying the tenant. */
export const startMetaOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) throw new Error("Falta configurar la app de Meta");

    const { data: owned } = await context.supabase
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a este cliente");

    const { META_SCOPES, redirectUri, signState } = await import("@/lib/meta/oauth.server");
    const state = await signState(
      { clientId: data.clientId, userId: context.userId, exp: Date.now() + 10 * 60 * 1000 },
      appSecret,
    );

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri(),
      state,
      response_type: "code",
      scope: META_SCOPES.join(","),
    });
    return { url: `https://www.facebook.com/${metaGraphVersion()}/dialog/oauth?${params.toString()}` };
  });

export const getMetaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row } = await (context.supabase.from("meta_accounts" as any) as any)
      .select(
        "id,client_id,ad_account_id,page_id,ig_account_id,business_name,scopes,connected,token_expires_at,last_synced_at,last_sync_error",
      )
      .eq("client_id", data.clientId)
      .maybeSingle();
    return (row ?? null) as MetaConnection | null;
  });

export const disconnectMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: owned } = await (context.supabase.from("meta_accounts" as any) as any)
      .select("id")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a esta conexión");

    const { setMetaToken } = await import("@/lib/meta/tokens.server");
    await setMetaToken(data.accountId, null);

    const { error } = await (context.supabase.from("meta_accounts" as any) as any)
      .update({ connected: false, scopes: [] })
      .eq("id", data.accountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Manual backfill / re-run of a single day for one connected account. */
export const syncMetaInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; date?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: owned } = await (context.supabase.from("meta_accounts" as any) as any)
      .select("id,client_id,ad_account_id,ig_account_id,connected")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a esta conexión");
    if (!owned.connected) throw new Error("La cuenta de Meta no está conectada");

    const { getMetaToken } = await import("@/lib/meta/tokens.server");
    const token = await getMetaToken(data.accountId);
    if (!token) throw new Error("No hay token de Meta guardado");

    const { ingestAccountDay, yesterdayISO } = await import("@/lib/meta/insights.server");
    return await ingestAccountDay(owned as any, token, data.date ?? yesterdayISO());
  });
