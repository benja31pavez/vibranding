import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MetaValidation } from "@/lib/meta/validate.server";

export type ClientConnectRow = {
  clientId: string;
  name: string;
  accountId: string | null;
  adAccountId: string | null;
  igAccountId: string | null;
  pageId: string | null;
  authType: string | null;
  connected: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  hasAdData: boolean;
  missing: string[];
};

/** Every client of the org with what is still missing to be fully connected. */
export const listClientConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClientConnectRow[]> => {
    const { data: clients } = await context.supabase
      .from("clients")
      .select("id,name")
      .order("name", { ascending: true });

    const { data: accounts } = await (context.supabase.from("meta_accounts" as any) as any).select(
      "id,client_id,ad_account_id,ig_account_id,page_id,auth_type,connected,last_synced_at,last_sync_error",
    );
    const byClient = new Map<string, any>(
      ((accounts ?? []) as any[]).map((a) => [a.client_id as string, a]),
    );

    const rows: ClientConnectRow[] = [];
    for (const c of (clients ?? []) as any[]) {
      const a = byClient.get(c.id) ?? null;
      const { count } = await context.supabase
        .from("ad_insights_daily")
        .select("id", { count: "exact", head: true })
        .eq("client_id", c.id);

      const missing: string[] = [];
      if (!a) missing.push("Conexión con Meta");
      if (!a?.ad_account_id) missing.push("Cuenta publicitaria");
      if (!a?.ig_account_id) missing.push("Instagram");
      if (a && !a.connected) missing.push("Validación");
      if ((count ?? 0) === 0) missing.push("Primera ingesta");

      rows.push({
        clientId: c.id,
        name: c.name,
        accountId: a?.id ?? null,
        adAccountId: a?.ad_account_id ?? null,
        igAccountId: a?.ig_account_id ?? null,
        pageId: a?.page_id ?? null,
        authType: a?.auth_type ?? null,
        connected: Boolean(a?.connected),
        lastSyncedAt: a?.last_synced_at ?? null,
        lastSyncError: a?.last_sync_error ?? null,
        hasAdData: (count ?? 0) > 0,
        missing,
      });
    }
    return rows;
  });

/** Assets the org-level token reaches, without needing a client context. */
export const discoverOrgAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: status, error } = await (context.supabase.rpc as any)("org_meta_token_status");
    if (error) throw new Error(error.message);
    const orgId = (status as any)?.org_id as string | undefined;
    if (!orgId) throw new Error("No perteneces a ninguna organización");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: token, error: tErr } = await (supabaseAdmin.rpc as any)("org_meta_get_secret", {
      _org_id: orgId,
    });
    if (tErr) throw new Error(tErr.message);
    const value = typeof token === "string" ? token.trim() : "";
    if (!value) throw new Error("La organización todavía no tiene un token de Meta guardado");

    const { discoverSystemUserAssets } = await import("@/lib/meta/systemUser.server");
    return await discoverSystemUserAssets(value);
  });

/** Re-runs /debug_token against the stored org token and refreshes its metadata. */
export const validateOrgMetaToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: status, error } = await (context.supabase.rpc as any)("org_meta_token_status");
    if (error) throw new Error(error.message);
    const orgId = (status as any)?.org_id as string | undefined;
    if (!orgId) throw new Error("No perteneces a ninguna organización");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: token } = await (supabaseAdmin.rpc as any)("org_meta_get_secret", {
      _org_id: orgId,
    });
    const value = typeof token === "string" ? token.trim() : "";
    if (!value) throw new Error("La organización todavía no tiene un token de Meta guardado");

    const { graph } = await import("@/lib/meta/oauth.server");
    const res = await graph<any>("debug_token", { input_token: value, access_token: value });
    const info = res?.data ?? {};
    if (info?.is_valid === false) {
      throw new Error(info?.error?.message ?? "Meta reporta el token como inválido");
    }
    const scopes: string[] = Array.isArray(info?.scopes) ? info.scopes : [];
    const expiresAt =
      info?.expires_at && Number(info.expires_at) > 0
        ? new Date(Number(info.expires_at) * 1000).toISOString()
        : null;

    const { error: sErr } = await (supabaseAdmin.rpc as any)("org_meta_set_secret", {
      _org_id: orgId,
      _secret: value,
      _expires_at: expiresAt,
      _scopes: scopes,
    });
    if (sErr) throw new Error(sErr.message);

    return {
      ok: true,
      scopes,
      expiresAt,
      tokenType: info?.type ?? null,
      appId: info?.app_id ? String(info.app_id) : null,
      validatedAt: new Date().toISOString(),
    };
  });

async function runValidation(clientId: string): Promise<MetaValidation | { ok: false; reason: string }> {
  const { getClientMetaToken } = await import("@/lib/meta/clientToken.server");
  const resolved = await getClientMetaToken(clientId);
  if (!resolved) return { ok: false, reason: "No hay token de Meta disponible para este cliente" };
  const { validateMetaAssets } = await import("@/lib/meta/validate.server");
  return await validateMetaAssets({
    token: resolved.token,
    adAccountId: resolved.account.ad_account_id,
    igAccountId: resolved.account.ig_account_id,
  });
}

/** Assigns assets to a client and only marks it connected if validation passes. */
export const assignClientAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      clientId: string;
      adAccountId: string | null;
      igAccountId: string | null;
      pageId?: string | null;
      businessName?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    if (!data.adAccountId && !data.igAccountId) {
      throw new Error("Selecciona al menos una cuenta publicitaria o de Instagram");
    }
    // Portal users can see their client row via RLS, so a plain select is not
    // enough: only agency editors may use the org's Meta token here.
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, data.clientId);

    const { normalizeAdAccountId } = await import("@/lib/meta/systemUser.server");
    const adAccountId = data.adAccountId ? normalizeAdAccountId(data.adAccountId) : null;

    if (adAccountId) {
      const bare = adAccountId.replace(/^act_/, "");
      const { data: rows } = await (context.supabase.from("meta_accounts" as any) as any)
        .select("client_id,clients(name)")
        .in("ad_account_id", [adAccountId, bare])
        .neq("client_id", data.clientId);
      const found = ((rows ?? []) as any[]).map(
        (r) => (r.clients?.name as string | null) ?? (r.client_id as string),
      );
      if (found.length > 0) {
        throw new Error(
          `La cuenta publicitaria ${adAccountId} ya está asignada a ${found.join(", ")}.`,
        );
      }
    }
    if (data.igAccountId) {
      const { data: igRows } = await (context.supabase.from("meta_accounts" as any) as any)
        .select("client_id,clients(name)")
        .eq("ig_account_id", data.igAccountId)
        .neq("client_id", data.clientId);
      const found = ((igRows ?? []) as any[]).map(
        (r) => (r.clients?.name as string | null) ?? (r.client_id as string),
      );
      if (found.length > 0) {
        throw new Error(`La cuenta de Instagram ya está asignada a ${found.join(", ")}.`);
      }
    }

    const { data: existing } = await (context.supabase.from("meta_accounts" as any) as any)
      .select("id,auth_type")
      .eq("client_id", data.clientId)
      .maybeSingle();

    const { assertMetaAssetsFree } = await import("@/lib/auth/clientAccess.server");
    await assertMetaAssetsFree(data.clientId, { adAccountId, igAccountId: data.igAccountId });

    // Identity columns are written with the service role after the editor
    // check, so the database can block direct rewrites by authenticated users.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin.from("meta_accounts" as any) as any).upsert(
      {
        client_id: data.clientId,
        ad_account_id: adAccountId,
        ig_account_id: data.igAccountId,
        page_id: data.pageId ?? null,
        business_name: data.businessName ?? null,
        auth_type: existing?.auth_type ?? "org_system_user",
        // Not connected until the validation below passes.
        connected: false,
        last_sync_error: null,
      },
      { onConflict: "client_id" },
    );
    if (error) throw new Error(error.message);

    const validation = await runValidation(data.clientId);
    if ((validation as MetaValidation).ok) {
      await (context.supabase.from("meta_accounts" as any) as any)
        .update({ connected: true, last_sync_error: null })
        .eq("client_id", data.clientId);
    } else {
      const reason =
        (validation as any).reason ??
        [
          (validation as MetaValidation).token?.error,
          (validation as MetaValidation).adAccount?.error,
          (validation as MetaValidation).instagram?.error,
        ]
          .filter(Boolean)
          .join(" · ");
      await (context.supabase.from("meta_accounts" as any) as any)
        .update({ connected: false, last_sync_error: reason || "Validación fallida" })
        .eq("client_id", data.clientId);
    }
    return { validation };
  });

/** Token / ad account / Instagram readability check for one client. */
export const validateClientMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    // Portal users can see their client row via RLS, so a plain select is not
    // enough: only agency editors may use the org's Meta token here.
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, data.clientId);

    const validation = await runValidation(data.clientId);
    const passed = Boolean((validation as MetaValidation).ok);
    await (context.supabase.from("meta_accounts" as any) as any)
      .update({ connected: passed })
      .eq("client_id", data.clientId);
    return { validation };
  });

/** Runs ad insights ingestion + Instagram sync and reports rows written. */
export const syncClientNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    // Portal users can see their client row via RLS, so a plain select is not
    // enough: only agency editors may use the org's Meta token here.
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, data.clientId);

    const { getClientMetaToken } = await import("@/lib/meta/clientToken.server");
    const resolved = await getClientMetaToken(data.clientId);
    if (!resolved) return { ok: false as const, reason: "No hay token de Meta para este cliente" };

    const out: {
      ok: true;
      adRows: number;
      postRows: number;
      igMedia: number | null;
      adsError?: string;
      igError?: string;
    } = { ok: true, adRows: 0, postRows: 0, igMedia: null };

    try {
      const { ingestAccountDay } = await import("@/lib/meta/insights.server");
      const res = await ingestAccountDay(resolved.account as any, resolved.token);
      out.adRows = res.adRows;
      out.postRows = res.postRows;
      if (res.error) out.adsError = res.error;
    } catch (e: any) {
      out.adsError = e?.message ?? String(e);
    }

    if (resolved.account.ig_account_id) {
      try {
        const { syncInstagramAccountData } = await import("@/lib/meta/igSync.server");
        const ig = await syncInstagramAccountData(
          data.clientId,
          resolved.account.ig_account_id,
          resolved.token,
        );
        out.igMedia = ig.mediaCount;
      } catch (e: any) {
        out.igError = e?.message ?? String(e);
      }
    }
    return out;
  });
