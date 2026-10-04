import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchAllRows } from "@/lib/db/fetchAllRows";
import { EMPTY_CLP_TOTALS, addClp, mergeClpTotals, type ClpTotals } from "@/lib/pricing/plans";
import { todayInChile } from "@/lib/billing/dates";
import { addIsoDays } from "@/lib/billing/openPayments";
import { chileMidnightUtc } from "@/lib/reports/period";

/** Rangos disponibles en /reports (días hacia atrás desde hoy, hora de Chile). */
export const REPORT_RANGES = [
  { days: 30, label: "Últimos 30 días" },
  { days: 90, label: "Últimos 90 días" },
  { days: 365, label: "Últimos 12 meses" },
] as const;
export type ReportRangeDays = (typeof REPORT_RANGES)[number]["days"];
export const DEFAULT_RANGE_DAYS: ReportRangeDays = 90;

export interface ClientMetricsRow {
  client_id: string;
  client_name: string;
  posts: number;
  likes: number;
  impressions: number;
  clicks: number;
  conversions: number;
  /** Gasto en Meta (CLP). Si la cuenta publicitaria usa otra moneda, queda fuera y se avisa. */
  spend: ClpTotals;
  paid: ClpTotals;
  pending: ClpTotals;
}

export type MetricsTotals = Omit<ClientMetricsRow, "client_id" | "client_name">;

export interface ClientMetrics {
  from: string;
  to: string;
  rows: ClientMetricsRow[];
  totals: MetricsTotals;
}

const EMPTY: MetricsTotals = {
  posts: 0,
  likes: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  spend: EMPTY_CLP_TOTALS,
  paid: EMPTY_CLP_TOTALS,
  pending: EMPTY_CLP_TOTALS,
};

function sumTotals(rows: readonly ClientMetricsRow[]): MetricsTotals {
  return rows.reduce<MetricsTotals>(
    (acc, r) => ({
      posts: acc.posts + r.posts,
      likes: acc.likes + r.likes,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      conversions: acc.conversions + r.conversions,
      spend: mergeClpTotals(acc.spend, r.spend),
      paid: mergeClpTotals(acc.paid, r.paid),
      pending: mergeClpTotals(acc.pending, r.pending),
    }),
    EMPTY,
  );
}

/**
 * Métricas por cliente en el rango [from, to]:
 *  - publicaciones y likes: posts publicados (published_at) en el rango;
 *  - Ads: filas de ad_insights_daily con `date` en el rango;
 *  - cobrado: pagos con paid_at en el rango; pendiente: todo lo abierto hoy.
 * Todas las consultas se paginan de a 1000 (sin tope silencioso de PostgREST).
 */
async function loadClientMetrics(days: number): Promise<ClientMetrics> {
  const to = todayInChile();
  const from = addIsoDays(to, -(days - 1));
  const [clients, posts, insights, paid, open] = await Promise.all([
    fetchAllRows((a, b) =>
      supabase.from("clients").select("id,name").order("name").order("id").range(a, b),
    ),
    fetchAllRows((a, b) =>
      supabase
        .from("instagram_posts")
        .select("id,client_id,likes_count")
        .gte("published_at", chileMidnightUtc(from))
        .order("id")
        .range(a, b),
    ),
    fetchAllRows((a, b) =>
      supabase
        .from("ad_insights_daily")
        .select("id,client_id,spend,impressions,clicks,messaging_conversations_started,currency")
        .gte("date", from)
        .lte("date", to)
        .order("id")
        .range(a, b),
    ),
    fetchAllRows((a, b) =>
      supabase
        .from("payments")
        .select("id,client_id,amount,currency")
        .eq("status", "paid")
        .gte("paid_at", from)
        .order("id")
        .range(a, b),
    ),
    fetchAllRows((a, b) =>
      supabase
        .from("payments")
        .select("id,client_id,amount,currency")
        .in("status", ["pending", "overdue"])
        .order("id")
        .range(a, b),
    ),
  ]);

  const byClient = new Map<string, ClientMetricsRow>(
    clients.map((c) => [c.id, { client_id: c.id, client_name: c.name, ...EMPTY }]),
  );
  const update = (clientId: string, fn: (r: ClientMetricsRow) => ClientMetricsRow) => {
    const row = byClient.get(clientId);
    if (row) byClient.set(clientId, fn(row));
  };
  for (const p of posts) {
    update(p.client_id, (r) => ({
      ...r,
      posts: r.posts + 1,
      likes: r.likes + Number(p.likes_count || 0),
    }));
  }
  for (const i of insights) {
    update(i.client_id, (r) => ({
      ...r,
      impressions: r.impressions + Number(i.impressions || 0),
      clicks: r.clicks + Number(i.clicks || 0),
      conversions: r.conversions + Number(i.messaging_conversations_started || 0),
      spend: addClp(r.spend, i.currency, Number(i.spend || 0)),
    }));
  }
  for (const p of paid) {
    update(p.client_id, (r) => ({
      ...r,
      paid: addClp(r.paid, p.currency, Number(p.amount || 0)),
    }));
  }
  for (const p of open) {
    update(p.client_id, (r) => ({
      ...r,
      pending: addClp(r.pending, p.currency, Number(p.amount || 0)),
    }));
  }
  const rows = [...byClient.values()];
  return { from, to, rows, totals: sumTotals(rows) };
}

export function useClientMetrics(days: ReportRangeDays) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: ["reports", "client-metrics", userId, days],
    enabled: Boolean(userId),
    queryFn: () => loadClientMetrics(days),
  });
}

export function ctrPercent(clicks: number, impressions: number): number {
  return impressions ? (clicks / impressions) * 100 : 0;
}
