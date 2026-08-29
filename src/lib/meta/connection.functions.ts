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
  auth_type?: string | null;
};

/** Inspects a pasted System User token and lists the assets it can reach. */
export const discoverSystemUserToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; token: string }) => input)
  .handler(async ({ data, context }) => {
    const token = data.token.trim();
    if (token.length < 20) throw new Error("El token pegado no parece válido");

    const { data: owned } = await context.supabase
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a este cliente");

    const { discoverSystemUserAssets } = await import("@/lib/meta/systemUser.server");
    return await discoverSystemUserAssets(token);
  });

/** Warns when an ad account is already assigned to a different client. */
export const checkAdAccountConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; adAccountId: string }) => input)
  .handler(async ({ data, context }) => {
    const { normalizeAdAccountId } = await import("@/lib/meta/systemUser.server");
    const adAccountId = normalizeAdAccountId(data.adAccountId);
    const bare = adAccountId.replace(/^act_/, "");

    const { data: rows } = await (context.supabase.from("meta_accounts" as any) as any)
      .select("client_id,ad_account_id,clients(name)")
      .in("ad_account_id", [adAccountId, bare])
      .neq("client_id", data.clientId);

    const conflicts = ((rows ?? []) as any[]).map((r) => ({
      clientId: r.client_id as string,
      clientName: (r.clients?.name as string | null) ?? null,
    }));
    return { adAccountId, conflicts };
  });

/**
 * Connects using a permanent System User token. The token is stored in Vault
 * exactly like the OAuth path; the table only keeps a reference.
 */
export const connectSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      clientId: string;
      token: string;
      adAccountId: string | null;
      igAccountId: string | null;
      pageId: string | null;
      businessName: string | null;
      timezoneName: string | null;
      scopes: string[];
      tokenExpiresAt: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const token = data.token.trim();
    if (!token) throw new Error("Falta el token");
    if (!data.adAccountId && !data.igAccountId) {
      throw new Error("Selecciona al menos una cuenta publicitaria o de Instagram");
    }

    const { data: owned } = await context.supabase
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a este cliente");

    const { normalizeAdAccountId } = await import("@/lib/meta/systemUser.server");
    const adAccountId = data.adAccountId ? normalizeAdAccountId(data.adAccountId) : null;

    // Uniqueness guard: never block, but report so spend is not double-counted.
    let conflicts: { clientId: string; clientName: string | null }[] = [];
    if (adAccountId) {
      const bare = adAccountId.replace(/^act_/, "");
      const { data: rows } = await (context.supabase.from("meta_accounts" as any) as any)
        .select("client_id,clients(name)")
        .in("ad_account_id", [adAccountId, bare])
        .neq("client_id", data.clientId);
      conflicts = ((rows ?? []) as any[]).map((r) => ({
        clientId: r.client_id as string,
        clientName: (r.clients?.name as string | null) ?? null,
      }));
    }

    const { data: saved, error } = await (context.supabase.from("meta_accounts" as any) as any)
      .upsert(
        {
          client_id: data.clientId,
          ad_account_id: adAccountId,
          page_id: data.pageId,
          ig_account_id: data.igAccountId,
          business_name: data.businessName,
          timezone_name: data.timezoneName,
          scopes: data.scopes ?? [],
          connected: true,
          auth_type: "system_user",
          token_expires_at: data.tokenExpiresAt,
          last_sync_error: null,
        },
        { onConflict: "client_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { setMetaToken } = await import("@/lib/meta/tokens.server");
    await setMetaToken(saved.id, token);

    return { ok: true, accountId: saved.id as string, conflicts };
  });

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

    const { META_SCOPES, redirectUri, signState, metaGraphVersion } = await import(
      "@/lib/meta/oauth.server",
    );
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
      .select("id,client_id,ad_account_id,ig_account_id,connected,timezone_name")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a esta conexión");
    if (!owned.connected) throw new Error("La cuenta de Meta no está conectada");

    const { getMetaToken } = await import("@/lib/meta/tokens.server");
    const token = await getMetaToken(data.accountId);
    if (!token) throw new Error("No hay token de Meta guardado");

    const { ingestAccountDay } = await import("@/lib/meta/insights.server");
    return await ingestAccountDay(owned as any, token, data.date ?? undefined);
  });
