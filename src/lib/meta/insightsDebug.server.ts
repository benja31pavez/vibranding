// Raw, unfiltered diagnostics for the async Meta insights job.
// Nothing here is prettified: every Meta response body is returned as-is so a
// failing ingestion can be inspected (report_run_id, async_status, error object).
import { graphUrl } from "@/lib/meta/oauth.server";

export type MetaInsightsDebug = {
  adAccountId: string;
  since: string;
  until: string;
  requestUrl: string;
  requestParams: Record<string, string>;
  startHttpStatus: number;
  startBody: any;
  reportRunId: string | null;
  polls: Array<{
    attempt: number;
    httpStatus: number;
    async_status: string | null;
    async_percent_completion: number | null;
    body: any;
  }>;
  finalAsyncStatus: string | null;
  resultHttpStatus: number | null;
  resultBody: any;
  rowCount: number | null;
  upsertAttempted: boolean;
  upsertError: any;
  upsertRows: number | null;
  fatalError: string | null;
};

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function debugAdInsightsRun(opts: {
  adAccountId: string;
  token: string;
  until: string;
  windowDays?: number;
  maxPolls?: number;
}): Promise<MetaInsightsDebug> {
  const acct = opts.adAccountId.startsWith("act_") ? opts.adAccountId : `act_${opts.adAccountId}`;
  const until = opts.until;
  const since = addDays(until, -(Math.max(1, opts.windowDays ?? 7) - 1));
  const maxPolls = opts.maxPolls ?? 12;

  const requestParams: Record<string, string> = {
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields:
      "date_start,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,clicks,ctr,cpm,actions,account_currency",
    limit: "500",
  };

  const out: MetaInsightsDebug = {
    adAccountId: acct,
    since,
    until,
    requestUrl: graphUrl(`${acct}/insights`),
    requestParams,
    startHttpStatus: 0,
    startBody: null,
    reportRunId: null,
    polls: [],
    finalAsyncStatus: null,
    resultHttpStatus: null,
    resultBody: null,
    rowCount: null,
    upsertAttempted: false,
    upsertError: null,
    upsertRows: null,
    fatalError: null,
  };

  try {
    const startRes = await fetch(out.requestUrl, {
      method: "POST",
      body: new URLSearchParams({ ...requestParams, access_token: opts.token }),
    });
    out.startHttpStatus = startRes.status;
    out.startBody = await startRes.json().catch(async () => await startRes.text());
    const runId = (out.startBody as any)?.report_run_id;
    if (!runId) return out;
    out.reportRunId = String(runId);

    for (let attempt = 0; attempt < maxPolls; attempt++) {
      await sleep(attempt === 0 ? 1500 : 3000);
      const res = await fetch(
        `${graphUrl(out.reportRunId)}?access_token=${encodeURIComponent(opts.token)}`,
      );
      const body = await res.json().catch(async () => await res.text());
      const state = (body as any)?.async_status ?? null;
      out.polls.push({
        attempt,
        httpStatus: res.status,
        async_status: state,
        async_percent_completion: (body as any)?.async_percent_completion ?? null,
        body,
      });
      out.finalAsyncStatus = state;
      if (state === "Job Completed" || state === "Job Failed" || state === "Job Skipped") break;
    }

    if (out.finalAsyncStatus !== "Job Completed") return out;

    const res = await fetch(
      `${graphUrl(`${out.reportRunId}/insights`)}?limit=500&access_token=${encodeURIComponent(opts.token)}`,
    );
    out.resultHttpStatus = res.status;
    out.resultBody = await res.json().catch(async () => await res.text());
    const data = (out.resultBody as any)?.data;
    out.rowCount = Array.isArray(data) ? data.length : null;
  } catch (e: any) {
    out.fatalError = e?.message ?? String(e);
  }
  return out;
}
