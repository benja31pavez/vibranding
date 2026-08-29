// Server-only daily insights ingestion for a connected Meta account.
// Uses Meta's ASYNC insights jobs (never the synchronous /insights read), and
// upserts on (client_id, date, entity_id) so re-running a day never duplicates.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { graph, META_GRAPH_VERSION } from "@/lib/meta/oauth.server";

const MESSAGING_ACTIONS = new Set([
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
]);

export type IngestResult = {
  accountId: string;
  clientId: string;
  date: string;
  adRows: number;
  postRows: number;
  error?: string;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Kick off an async insights report and wait for it to complete. */
async function runAsyncInsightsJob(
  adAccountId: string,
  token: string,
  date: string,
): Promise<any[]> {
  const acct = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const startRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${acct}/insights`,
    {
      method: "POST",
      body: new URLSearchParams({
        access_token: token,
        level: "ad",
        time_increment: "1",
        time_range: JSON.stringify({ since: date, until: date }),
        fields:
          "date_start,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,clicks,ctr,cpm,actions,account_currency",
        limit: "500",
      }),
    },
  );
  const started = (await startRes.json()) as any;
  if (!startRes.ok || !started?.report_run_id) {
    throw new Error(
      started?.error?.error_user_msg ?? started?.error?.message ?? "No se pudo crear el reporte",
    );
  }
  const runId = String(started.report_run_id);

  // Poll the job status. Meta recommends polling; jobs are usually quick for one day.
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(attempt === 0 ? 1500 : 3000);
    const status = await graph<any>(runId, { access_token: token });
    const state = status?.async_status as string | undefined;
    if (state === "Job Completed") break;
    if (state === "Job Failed" || state === "Job Skipped") {
      throw new Error(`Reporte de Meta ${state}`);
    }
    if (attempt === 29) throw new Error("El reporte de Meta no terminó en el tiempo esperado");
  }

  // Drain the paginated result set.
  const rows: any[] = [];
  let url =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${runId}/insights` +
    `?limit=500&access_token=${encodeURIComponent(token)}`;
  while (url) {
    const res = await fetch(url);
    const body = (await res.json()) as any;
    if (!res.ok) {
      throw new Error(body?.error?.message ?? "Error leyendo el reporte de Meta");
    }
    rows.push(...(body.data ?? []));
    url = body.paging?.next ?? "";
  }
  return rows;
}

async function ingestAdInsights(
  clientId: string,
  adAccountId: string,
  token: string,
  date: string,
): Promise<number> {
  const rows = await runAsyncInsightsJob(adAccountId, token, date);
  if (rows.length === 0) return 0;

  const payload = rows.map((r) => {
    const messaging = (r.actions ?? [])
      .filter((a: any) => MESSAGING_ACTIONS.has(a.action_type))
      .reduce((acc: number, a: any) => Math.max(acc, num(a.value)), 0);
    return {
      client_id: clientId,
      date: r.date_start ?? date,
      level: "ad",
      entity_id: String(r.ad_id ?? `${r.adset_id ?? r.campaign_id ?? "unknown"}`),
      campaign_id: r.campaign_id ?? null,
      adset_id: r.adset_id ?? null,
      ad_id: r.ad_id ?? null,
      campaign_name: r.campaign_name ?? null,
      adset_name: r.adset_name ?? null,
      ad_name: r.ad_name ?? null,
      spend: num(r.spend),
      impressions: num(r.impressions),
      reach: num(r.reach),
      clicks: num(r.clicks),
      ctr: r.ctr != null ? num(r.ctr) : null,
      cpm: r.cpm != null ? num(r.cpm) : null,
      messaging_conversations_started: messaging,
      currency: r.account_currency ?? null,
    };
  });

  const { error } = await (supabaseAdmin.from("ad_insights_daily" as any) as any).upsert(payload, {
    onConflict: "client_id,date,entity_id",
  });
  if (error) throw new Error(error.message);
  return payload.length;
}

async function ingestPostInsights(
  clientId: string,
  igAccountId: string,
  token: string,
  date: string,
): Promise<number> {
  // Media published in a window around the target day, then per-media insights.
  const since = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000) - 30 * 86400;
  const media = await graph<any>(`${igAccountId}/media`, {
    access_token: token,
    fields: "id,media_type,permalink,timestamp",
    since: String(since),
    limit: "50",
  });

  const payload: any[] = [];
  for (const m of media.data ?? []) {
    try {
      const ins = await graph<any>(`${m.id}/insights`, {
        access_token: token,
        metric: "reach,saved,total_interactions",
      });
      const byName: Record<string, number> = {};
      for (const item of ins.data ?? []) {
        byName[item.name] = num(item.values?.[0]?.value);
      }
      payload.push({
        client_id: clientId,
        date,
        post_id: String(m.id),
        platform: "instagram",
        permalink: m.permalink ?? null,
        media_type: m.media_type ?? null,
        reach: byName.reach ?? 0,
        engagement: byName.total_interactions ?? 0,
        saves: byName.saved ?? 0,
      });
    } catch (e: any) {
      console.warn("[meta] post insights skipped", m.id, e?.message);
    }
  }
  if (payload.length === 0) return 0;

  const { error } = await (supabaseAdmin.from("post_insights_daily" as any) as any).upsert(
    payload,
    { onConflict: "client_id,date,post_id" },
  );
  if (error) throw new Error(error.message);
  return payload.length;
}

export function yesterdayISO(): string {
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export async function ingestAccountDay(
  account: {
    id: string;
    client_id: string;
    ad_account_id: string | null;
    ig_account_id: string | null;
  },
  token: string,
  date: string,
): Promise<IngestResult> {
  const result: IngestResult = {
    accountId: account.id,
    clientId: account.client_id,
    date,
    adRows: 0,
    postRows: 0,
  };
  try {
    if (account.ad_account_id) {
      result.adRows = await ingestAdInsights(account.client_id, account.ad_account_id, token, date);
    }
    if (account.ig_account_id) {
      result.postRows = await ingestPostInsights(
        account.client_id,
        account.ig_account_id,
        token,
        date,
      );
    }
    await (supabaseAdmin.from("meta_accounts" as any) as any)
      .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
      .eq("id", account.id);
  } catch (e: any) {
    result.error = e?.message ?? "Error inesperado";
    await (supabaseAdmin.from("meta_accounts" as any) as any)
      .update({ last_synced_at: new Date().toISOString(), last_sync_error: result.error })
      .eq("id", account.id);
  }
  return result;
}
