// Server-only daily insights ingestion for a connected Meta account.
// Uses Meta's ASYNC insights jobs (never the synchronous /insights read), and
// upserts on (client_id, date, entity_id) so re-running a day never duplicates.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { graph, graphUrl, metaGraphVersion } from "@/lib/meta/oauth.server";

const MESSAGING_ACTIONS = new Set([
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
]);

/** Meta restates spend/conversions for up to 28 days; re-ingest a trailing window. */
export const INGEST_WINDOW_DAYS = 7;

export type IngestResult = {
  accountId: string;
  clientId: string;
  date: string;
  from: string;
  to: string;
  timezone: string | null;
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

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date in the ad account's own timezone (falls back to UTC). */
export function todayInTimezone(timeZone?: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Yesterday in the ad account's local calendar — the last fully closed day. */
export function yesterdayISO(timeZone?: string | null): string {
  return addDays(todayInTimezone(timeZone), -1);
}

/** Read (and refresh) the ad account's own reporting timezone from Meta. */
export async function fetchAdAccountTimezone(
  adAccountId: string,
  token: string,
): Promise<string | null> {
  const acct = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  try {
    const info = await graph<any>(acct, { access_token: token, fields: "timezone_name" });
    return (info?.timezone_name as string) ?? null;
  } catch (e: any) {
    console.warn("[meta] cannot read ad account timezone", e?.message);
    return null;
  }
}

/** Kick off an async insights report for a date range and wait for it to complete. */
async function runAsyncInsightsJob(
  adAccountId: string,
  token: string,
  since: string,
  until: string,
): Promise<any[]> {
  const acct = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const startRes = await fetch(graphUrl(`${acct}/insights`), {
    method: "POST",
    body: new URLSearchParams({
      access_token: token,
      level: "ad",
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      fields:
        "date_start,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,clicks,ctr,cpm,actions,account_currency",
      limit: "500",
    }),
  });
  const started = (await startRes.json()) as any;
  if (!startRes.ok || !started?.report_run_id) {
    throw new Error(
      started?.error?.error_user_msg ?? started?.error?.message ?? "No se pudo crear el reporte",
    );
  }
  const runId = String(started.report_run_id);

  // Meta recommends polling; a 7-day ad-level report is still quick.
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(attempt === 0 ? 1500 : 3000);
    const status = await graph<any>(runId, { access_token: token });
    const state = status?.async_status as string | undefined;
    if (state === "Job Completed") break;
    if (state === "Job Failed" || state === "Job Skipped") {
      throw new Error(`Reporte de Meta ${state}`);
    }
    if (attempt === 39) throw new Error("El reporte de Meta no terminó en el tiempo esperado");
  }

  // Drain the paginated result set.
  const rows: any[] = [];
  let url =
    `${graphUrl(`${runId}/insights`)}?limit=500&access_token=${encodeURIComponent(token)}`;
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
  since: string,
  until: string,
): Promise<number> {
  const rows = await runAsyncInsightsJob(adAccountId, token, since, until);
  if (rows.length === 0) return 0;

  const payload = rows.map((r) => {
    const messaging = (r.actions ?? [])
      .filter((a: any) => MESSAGING_ACTIONS.has(a.action_type))
      .reduce((acc: number, a: any) => Math.max(acc, num(a.value)), 0);
    return {
      client_id: clientId,
      // date_start comes back in the ad account's own timezone, so each row is
      // already attributed to the account's local day (never the UTC day).
      date: r.date_start ?? until,
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

  // Idempotent across the whole window: the unique key is (client_id, date, entity_id),
  // so re-ingesting restated days overwrites instead of duplicating.
  const { error } = await (supabaseAdmin.from("ad_insights_daily" as any) as any).upsert(payload, {
    onConflict: "client_id,date,entity_id",
  });
  if (error) throw new Error(error.message);
  return payload.length;
}

/**
 * Media-level metrics. Instagram retired the legacy `reach` metric for media in
 * June 2026 in favour of Media Views (`views`), and several metrics are simply
 * unavailable for some media types. Ask for the modern set, and fall back to
 * per-metric requests so one unsupported metric never kills the ingestion.
 */
const IG_MEDIA_METRICS = ["views", "total_interactions", "saved"] as const;

async function fetchMediaMetrics(
  mediaId: string,
  token: string,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const collect = (data: any[]) => {
    for (const item of data ?? []) out[item.name] = num(item.values?.[0]?.value);
  };

  try {
    const ins = await graph<any>(`${mediaId}/insights`, {
      access_token: token,
      metric: IG_MEDIA_METRICS.join(","),
    });
    collect(ins.data ?? []);
    return out;
  } catch {
    // Unsupported metric for this media type: retry each metric on its own.
  }

  for (const metric of IG_MEDIA_METRICS) {
    try {
      const ins = await graph<any>(`${mediaId}/insights`, { access_token: token, metric });
      collect(ins.data ?? []);
    } catch (e: any) {
      console.warn(`[meta] metric ${metric} unavailable for media ${mediaId}: ${e?.message}`);
    }
  }
  return out;
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
    const byName = await fetchMediaMetrics(String(m.id), token);
    if (Object.keys(byName).length === 0) continue;
    payload.push({
      client_id: clientId,
      date,
      post_id: String(m.id),
      platform: "instagram",
      permalink: m.permalink ?? null,
      media_type: m.media_type ?? null,
      // `views` (Media Views) replaces the retired media `reach` metric.
      reach: byName["views"] ?? 0,
      engagement: byName["total_interactions"] ?? 0,
      saves: byName["saved"] ?? 0,
    });
  }
  if (payload.length === 0) return 0;

  const { error } = await (supabaseAdmin.from("post_insights_daily" as any) as any).upsert(
    payload,
    { onConflict: "client_id,date,post_id" },
  );
  if (error) throw new Error(error.message);
  return payload.length;
}

type MetaAccountForIngest = {
  id: string;
  client_id: string;
  ad_account_id: string | null;
  ig_account_id: string | null;
  timezone_name?: string | null;
};

/** Refresh the ad account's reporting timezone so local dates stay correct. Throws on DB error. */
async function refreshTimezone(account: MetaAccountForIngest, token: string): Promise<string | null> {
  const current = account.timezone_name ?? null;
  if (!account.ad_account_id) return current;
  const fresh = await fetchAdAccountTimezone(account.ad_account_id, token);
  if (!fresh || fresh === current) return current;
  const { error } = await (supabaseAdmin.from("meta_accounts" as any) as any)
    .update({ timezone_name: fresh })
    .eq("id", account.id);
  if (error) throw new Error(`No se pudo guardar la zona horaria: ${error.message}`);
  return fresh;
}

/**
 * Records the outcome on meta_accounts. last_synced_at / last_ingest_* only move
 * on success; a failure only writes last_sync_error (no last_attempt_at column).
 * Returns the DB error message, or null.
 */
async function recordIngestOutcome(accountId: string, result: IngestResult): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const rows = result.adRows + result.postRows;
  const patch = result.error
    ? { last_sync_error: result.error }
    : {
        last_synced_at: nowIso,
        last_sync_error: null,
        last_ingest_at: nowIso,
        last_ingest_rows: rows,
      };
  const { error } = await (supabaseAdmin.from("meta_accounts" as any) as any)
    .update(patch)
    .eq("id", accountId);
  if (!error) return null;
  console.error("[meta] cannot record ingest outcome", { accountId, message: error.message });
  return error.message as string;
}

async function ingestWindowData(
  account: MetaAccountForIngest,
  token: string,
  from: string,
  until: string,
): Promise<{ adRows: number; postRows: number }> {
  const adRows = account.ad_account_id
    ? await ingestAdInsights(account.client_id, account.ad_account_id, token, from, until)
    : 0;
  const postRows = account.ig_account_id
    ? await ingestPostInsights(account.client_id, account.ig_account_id, token, until)
    : 0;
  return { adRows, postRows };
}

/** Never throws: any failure (timezone, Meta, DB) comes back in `error`. */
export async function ingestAccountDay(
  account: MetaAccountForIngest,
  token: string,
  /** Last day of the window; defaults to yesterday in the account's timezone. */
  date?: string,
  windowDays: number = INGEST_WINDOW_DAYS,
): Promise<IngestResult> {
  const fallbackUntil = date ?? yesterdayISO(account.timezone_name);
  let result: IngestResult = {
    accountId: account.id,
    clientId: account.client_id,
    date: fallbackUntil,
    from: addDays(fallbackUntil, -(Math.max(1, windowDays) - 1)),
    to: fallbackUntil,
    timezone: account.timezone_name ?? null,
    adRows: 0,
    postRows: 0,
  };
  try {
    const timezone = await refreshTimezone(account, token);
    const until = date ?? yesterdayISO(timezone);
    const from = addDays(until, -(Math.max(1, windowDays) - 1));
    result = { ...result, timezone, date: until, from, to: until };
    const rows = await ingestWindowData(account, token, from, until);
    result = { ...result, ...rows };
  } catch (e: any) {
    result = { ...result, error: e?.message ?? "Error inesperado" };
  }

  const dbError = await recordIngestOutcome(account.id, result);
  if (dbError && !result.error) {
    // Data was written, but the account status was not: surface it so the run isn't "green".
    return { ...result, error: `Métricas guardadas, pero no se pudo actualizar el estado: ${dbError}` };
  }
  return result;
}

export { metaGraphVersion };
