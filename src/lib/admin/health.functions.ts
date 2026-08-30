import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type JobHealthRow = {
  job_name: string;
  active: boolean | null;
  schedule: string | null;
  last_run: string | null;
  last_success: string | null;
  failed_24h: number;
  total_24h: number;
};

export type JobRunRow = {
  id: string;
  job_name: string;
  status: string;
  http_status: number | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  rows_written: number | null;
  response_body: Record<string, unknown> | null;
};

/** A connected Meta account that is not actually producing any data. */
export type ConnectionDataRow = {
  clientId: string;
  clientName: string | null;
  adAccountId: string | null;
  igAccountId: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  adInsightRows: number;
  syncedInstagramPosts: number;
};

/**
 * job_runs and job_health() are service-role only, so the page reads them
 * through this authenticated server function.
 */
export const getJobHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: health, error } = await (supabaseAdmin.rpc as any)("job_health");
    if (error) throw new Error(error.message);

    const { data: recent } = await (supabaseAdmin.from("job_runs" as any) as any)
      .select("id,job_name,status,http_status,error,started_at,finished_at,rows_written,response_body")
      .order("started_at", { ascending: false })
      .limit(25);

    // A "connected" account that never wrote a row must not look healthy.
    const { data: accounts } = await (supabaseAdmin.from("meta_accounts" as any) as any)
      .select(
        "client_id,ad_account_id,ig_account_id,last_synced_at,last_sync_error,clients(name)",
      )
      .eq("connected", true);

    const connections: ConnectionDataRow[] = [];
    for (const a of (accounts ?? []) as any[]) {
      const [{ count: adRows }, { count: igPosts }] = await Promise.all([
        (supabaseAdmin.from("ad_insights_daily" as any) as any)
          .select("id", { count: "exact", head: true })
          .eq("client_id", a.client_id),
        (supabaseAdmin.from("instagram_posts" as any) as any)
          .select("id", { count: "exact", head: true })
          .eq("client_id", a.client_id)
          .not("ig_media_id", "is", null),
      ]);
      connections.push({
        clientId: a.client_id,
        clientName: a.clients?.name ?? null,
        adAccountId: a.ad_account_id ?? null,
        igAccountId: a.ig_account_id ?? null,
        lastSyncedAt: a.last_synced_at ?? null,
        lastSyncError: a.last_sync_error ?? null,
        adInsightRows: Number(adRows ?? 0),
        syncedInstagramPosts: Number(igPosts ?? 0),
      });
    }

    return {
      jobs: (health ?? []) as JobHealthRow[],
      recent: (recent ?? []) as JobRunRow[],
      connections,
      checkedAt: new Date().toISOString(),
    };
  });
