export type Funnel = {
  started: number;
  answered?: number;
  qualified: number;
  closed: number;
  marked: number;
  value_clp: number;
  closed_with_value?: number;
};

export type Campaign = {
  campaign_id: string;
  campaign_name: string | null;
  spend: number;
  conversations_started: number;
  attributed: number;
  marked: number;
  qualified: number;
  closed: number;
  value_clp: number;
};

export type HeatCell = {
  dow: number;
  hour: number;
  median_seconds: number | null;
  sample: number;
};

export type PostRow = {
  post_id: string;
  permalink: string | null;
  media_type: string | null;
  reach: number;
  engagement: number;
  saves: number;
};

export type Analytics = {
  range: { from: string; to: string; days: number; prev_from: string; prev_to: string };
  funnel: Funnel;
  funnel_prev: Funnel;
  spend: number;
  spend_prev: number;
  meta_conversations_started: number;
  has_spend_data: boolean;
  response_time: { median_seconds: number | null; sample: number };
  response_time_prev: { median_seconds: number | null };
  heatmap: HeatCell[];
  campaigns: Campaign[];
  posts: PostRow[];
};

export const clp = (v: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(v);

export const num = (v: number) => new Intl.NumberFormat("es-CL").format(v);

export const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function duration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

/**
 * Returns null when either side is unmeasurable, so the UI can stay blank
 * instead of implying a 0% change.
 */
export function delta(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export function safeRatio(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

export const DOW_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
