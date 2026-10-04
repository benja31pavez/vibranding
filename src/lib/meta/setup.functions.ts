import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SetupAccount = {
  id: string;
  ad_account_id: string | null;
  ig_account_id: string | null;
  business_name: string | null;
  auth_type: string | null;
  connected: boolean;
  scopes: string[];
  currency: string | null;
  timezone_name: string | null;
  token_valid: boolean | null;
  token_expires_at: string | null;
  last_validated_at: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  last_ingest_at: string | null;
  last_ingest_rows: number | null;
  last_ingest_reason: string | null;
  last_ig_sync_at: string | null;
};

export type SetupStatus = {
  account: SetupAccount | null;
  instagram: { username: string | null; followers: number | null; syncedAt: string | null } | null;
};

const SELECT =
  "id,ad_account_id,ig_account_id,business_name,auth_type,connected,scopes,currency,timezone_name,token_valid,token_expires_at,last_validated_at,last_synced_at,last_sync_error,last_ingest_at,last_ingest_rows,last_ingest_reason,last_ig_sync_at";

/** Everything the "Listo" states of the checklist display, read from the DB. */
export const getSetupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; revalidate?: boolean }) => input)
  .handler(async ({ data, context }): Promise<SetupStatus> => {
    const { data: row } = await (context.supabase.from("meta_accounts" as any) as any)
      .select(SELECT)
      .eq("client_id", data.clientId)
      .maybeSingle();

    let account = (row ?? null) as SetupAccount | null;

    // Refresh token/ad-account facts at most once an hour, or on demand.
    const stale =
      !account?.last_validated_at ||
      Date.now() - new Date(account.last_validated_at).getTime() > 60 * 60 * 1000;
    // Revalidating calls Meta with the agency token: editors only. Viewers
    // still get the stored status.
    const { getClientOrgRole, CLIENT_EDITOR_ROLES } = await import("@/lib/auth/clientAccess.server");
    const role = account ? await getClientOrgRole(context.userId, data.clientId) : null;
    const canRevalidate = role !== null && CLIENT_EDITOR_ROLES.includes(role);
    if (account?.connected && canRevalidate && (data.revalidate || stale)) {
      const { getMetaToken } = await import("@/lib/meta/tokens.server");
      const token = await getMetaToken(account.id);
      if (token) {
        const { refreshAccountFacts } = await import("@/lib/meta/setup.server");
        await refreshAccountFacts(account, token);
        const { data: fresh } = await (context.supabase.from("meta_accounts" as any) as any)
          .select(SELECT)
          .eq("id", account.id)
          .maybeSingle();
        account = (fresh ?? account) as SetupAccount;
      } else {
        account = { ...account, token_valid: false };
      }
    }

    const { data: profile } = await context.supabase
      .from("instagram_profiles")
      .select("current_username,current_followers,current_synced_at")
      .eq("client_id", data.clientId)
      .maybeSingle();

    return {
      account,
      instagram: profile
        ? {
            username: profile.current_username ?? null,
            followers: profile.current_followers ?? null,
            syncedAt: profile.current_synced_at ?? null,
          }
        : null,
    };
  });

export type SetupIngestResult = {
  ok: boolean;
  from: string;
  to: string;
  adRows: number;
  postRows: number;
  error?: string;
  causes: { code: string; message: string }[];
};

/**
 * Ingestion for an explicit date window. Success is recorded even when zero
 * rows were written, so the checklist step can be completed.
 */
export const runSetupIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; from: string; to: string }) => input)
  .handler(async ({ data, context }): Promise<SetupIngestResult> => {
    const { data: account } = await (context.supabase.from("meta_accounts" as any) as any)
      .select("id,client_id,ad_account_id,ig_account_id,connected,timezone_name")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!account) throw new Error("No tienes acceso a esta conexión");
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, account.client_id);
    if (!account.connected) throw new Error("La cuenta de Meta no está conectada");

    const { getMetaToken } = await import("@/lib/meta/tokens.server");
    const token = await getMetaToken(data.accountId);
    if (!token) throw new Error("No hay token de Meta guardado");

    const days =
      Math.round(
        (new Date(`${data.to}T00:00:00Z`).getTime() - new Date(`${data.from}T00:00:00Z`).getTime()) /
          86400000,
      ) + 1;

    const { ingestAccountDay } = await import("@/lib/meta/insights.server");
    const res = await ingestAccountDay(account as any, token, data.to, Math.max(1, days));

    const { diagnoseIngest } = await import("@/lib/meta/setup.server");
    const causes = await diagnoseIngest({
      clientId: account.client_id,
      token,
      adAccountId: account.ad_account_id,
      igAccountId: account.ig_account_id,
      from: res.from,
      to: res.to,
      adRows: res.adRows,
      postRows: res.postRows,
      error: res.error,
    });

    const rows = res.adRows + res.postRows;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!res.error) {
      await (supabaseAdmin.from("meta_accounts" as any) as any)
        .update({
          last_ingest_at: new Date().toISOString(),
          last_ingest_rows: rows,
          last_ingest_reason: causes.map((c) => c.message).join(" ") || null,
        })
        .eq("id", account.id);
    } else {
      await (supabaseAdmin.from("meta_accounts" as any) as any)
        .update({ last_ingest_reason: res.error })
        .eq("id", account.id);
    }

    return {
      ok: !res.error,
      from: res.from,
      to: res.to,
      adRows: res.adRows,
      postRows: res.postRows,
      error: res.error,
      causes,
    };
  });
