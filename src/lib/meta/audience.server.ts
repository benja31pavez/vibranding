// Server-only: pulls Instagram follower demographics (aggregated, anonymous)
// and stores weekly snapshots with an auditable coverage ratio.
//
// Meta only returns these aggregates for accounts with 100+ followers, and it
// excludes private accounts and followers without declared/inferred data, so
// the sum of the categories is always lower than the follower count. We store
// that gap explicitly instead of hiding it.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { graph } from "@/lib/meta/oauth.server";
import { metaGraphVersion } from "@/lib/meta/version";

export const DEMOGRAPHICS_MIN_FOLLOWERS = 100;
export const DEMOGRAPHICS_METRIC = "follower_demographics";
export const DEMOGRAPHICS_TIMEFRAME = "last_30_days";
export const SNAPSHOT_INTERVAL_DAYS = 7;

export type Breakdown = "age" | "gender" | "country" | "city" | "age_gender";

const BREAKDOWNS: { key: Breakdown; param: string }[] = [
  { key: "age", param: "age" },
  { key: "gender", param: "gender" },
  { key: "country", param: "country" },
  { key: "city", param: "city" },
  { key: "age_gender", param: "age,gender" },
];

export type BreakdownResult = {
  breakdown: Breakdown;
  rows: { key: string; value: number }[];
  total: number;
  error?: string;
};

export type SnapshotResult =
  | {
      ok: true;
      date: string;
      followers: number;
      breakdowns: BreakdownResult[];
      rowsWritten: number;
      skipped?: "recent";
    }
  | { ok: false; reason: string; followers?: number };

/** Monday of the current ISO week — snapshots are weekly, keyed by that date. */
export function weekStart(d = new Date()): string {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (utc.getUTCDay() + 6) % 7; // 0 = Monday
  utc.setUTCDate(utc.getUTCDate() - dow);
  return utc.toISOString().slice(0, 10);
}

async function fetchBreakdown(
  igAccountId: string,
  token: string,
  b: { key: Breakdown; param: string },
): Promise<BreakdownResult> {
  try {
    const res = await graph<any>(`${igAccountId}/insights`, {
      access_token: token,
      metric: DEMOGRAPHICS_METRIC,
      period: "lifetime",
      metric_type: "total_value",
      timeframe: DEMOGRAPHICS_TIMEFRAME,
      breakdown: b.param,
    });
    const results =
      res?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? ([] as any[]);
    const rows = (results as any[])
      .map((r) => ({
        key: (r.dimension_values ?? []).filter(Boolean).join(" · ") || "desconocido",
        value: Number(r.value) || 0,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b2) => b2.value - a.value);
    return {
      breakdown: b.key,
      rows,
      total: rows.reduce((a, r) => a + r.value, 0),
    };
  } catch (e: any) {
    return { breakdown: b.key, rows: [], total: 0, error: e?.message ?? "Error Meta API" };
  }
}

/**
 * Reads demographics for one client and upserts this week's snapshot.
 * Returns a discriminated failure instead of throwing so the UI can explain
 * exactly which precondition is missing.
 */
export async function snapshotAudience(
  clientId: string,
  igAccountId: string,
  token: string,
  opts: { force?: boolean } = {},
): Promise<SnapshotResult> {
  const { data: profile } = await supabaseAdmin
    .from("instagram_profiles")
    .select("current_followers")
    .eq("client_id", clientId)
    .maybeSingle();

  const followers = Number(profile?.current_followers) || 0;
  if (followers < DEMOGRAPHICS_MIN_FOLLOWERS) {
    return {
      ok: false,
      followers,
      reason: `Instagram entrega datos demográficos solo para cuentas con ${DEMOGRAPHICS_MIN_FOLLOWERS} seguidores o más. Esta cuenta tiene ${followers}. La sección se activará sola cuando supere ese umbral.`,
    };
  }

  const date = weekStart();
  if (!opts.force) {
    const { data: existing } = await supabaseAdmin
      .from("instagram_audience_snapshots")
      .select("date")
      .eq("client_id", clientId)
      .eq("date", date)
      .limit(1);
    if ((existing ?? []).length > 0) {
      return { ok: true, date, followers, breakdowns: [], rowsWritten: 0, skipped: "recent" };
    }
  }

  const breakdowns: BreakdownResult[] = [];
  for (const b of BREAKDOWNS) breakdowns.push(await fetchBreakdown(igAccountId, token, b));

  const rows = breakdowns.flatMap((b) =>
    b.rows.map((r) => ({
      client_id: clientId,
      date,
      breakdown: b.breakdown,
      key: r.key,
      value: r.value,
      followers_total: followers,
      breakdown_total: b.total,
      coverage: followers > 0 ? Number((b.total / followers).toFixed(4)) : null,
    })),
  );

  if (rows.length > 0) {
    const { error } = await supabaseAdmin
      .from("instagram_audience_snapshots")
      .upsert(rows, { onConflict: "client_id,date,breakdown,key" });
    if (error) return { ok: false, followers, reason: error.message };
  }

  return { ok: true, date, followers, breakdowns, rowsWritten: rows.length };
}

export function methodology() {
  return {
    graphVersion: metaGraphVersion(),
    metric: DEMOGRAPHICS_METRIC,
    timeframe: DEMOGRAPHICS_TIMEFRAME,
    breakdowns: BREAKDOWNS.map((b) => b.param),
    intervalDays: SNAPSHOT_INTERVAL_DAYS,
  };
}
