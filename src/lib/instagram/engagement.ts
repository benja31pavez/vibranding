// Pure engagement math for an Instagram profile. No I/O: the server layer
// (engagement.server.ts) fetches media from the official Graph API and hands
// plain numbers to these helpers, so the same code runs in the check script.

/** Posts considered for the average (the most recent ones). */
export const ENGAGEMENT_SAMPLE_SIZE = 12;
/** Posts younger than this are still collecting likes and are skipped. */
export const MIN_POST_AGE_HOURS = 24;
/** Media requested from Graph so 12 remain after skipping the fresh ones. */
export const ENGAGEMENT_FETCH_LIMIT = 20;
/** A stored measurement is reused instead of calling Graph again (rate limits). */
export const ENGAGEMENT_CACHE_HOURS = 12;

const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * HOUR_MS;

export type EngagementSource = "own" | "discovery";
export type EngagementLevel = "alto" | "medio" | "bajo";

/** One stored row of ig_engagement_snapshots (numbers already parsed). */
export type EngagementSnapshot = {
  id: string;
  client_id: string;
  measured_at: string;
  source: EngagementSource;
  username: string | null;
  followers: number | null;
  posts_sampled: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  engagement_rate: number | null;
  posts_per_week: number | null;
  error: string | null;
};

export type EngagementMediaInput = {
  timestamp: string | null;
  like_count?: number | null;
  comments_count?: number | null;
};

export type EngagementMetrics = {
  followers: number;
  postsSampled: number;
  avgLikes: number;
  avgComments: number;
  /** Percentage with 2 decimals, e.g. 2.37 means 2.37 %. */
  engagementRate: number;
  /** Null when there are fewer than 2 dated posts to measure a span. */
  postsPerWeek: number | null;
};

type EngagementOk = { ok: true; metrics: EngagementMetrics };
type EngagementFailure = { ok: false; error: string };
export type EngagementComputation = EngagementOk | EngagementFailure;

/**
 * Benchmark thresholds by follower tier. REFERENCE VALUES ONLY: commonly cited
 * industry ranges for Instagram engagement by account size, not a Meta
 * standard. Larger accounts naturally get a lower rate, so each tier has its
 * own bar. `high` and `medium` are minimum rates (in %) for that label.
 */
export const ENGAGEMENT_BENCHMARK_TIERS = [
  { maxFollowers: 10_000, label: "Menos de 10 mil seguidores", high: 3, medium: 1 },
  { maxFollowers: 100_000, label: "10 mil a 100 mil seguidores", high: 2, medium: 0.8 },
  {
    maxFollowers: Number.POSITIVE_INFINITY,
    label: "Más de 100 mil seguidores",
    high: 1,
    medium: 0.4,
  },
] as const;

export type EngagementBenchmarkTier = (typeof ENGAGEMENT_BENCHMARK_TIERS)[number];

export const ENGAGEMENT_ERRORS = {
  noFollowers: "La cuenta no tiene seguidores: no se puede calcular el engagement.",
  noPosts: `No hay publicaciones con más de ${MIN_POST_AGE_HOURS} h para medir.`,
  hiddenCounts: "El perfil oculta los likes de sus publicaciones: no se puede medir.",
  privateOrPersonal: "Perfil personal o privado: no se puede medir.",
} as const;

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function toTime(ts: string | null): number | null {
  if (!ts) return null;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : null;
}

function isCount(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/**
 * Most recent posts (max 12) that are at least 24 h old and expose both
 * counters. Posts without a valid timestamp are skipped: their age is unknown.
 */
export function selectSample(
  media: readonly EngagementMediaInput[],
  now: Date,
): { sample: EngagementMediaInput[]; hiddenCounts: number } {
  const cutoff = now.getTime() - MIN_POST_AGE_HOURS * HOUR_MS;
  const oldEnough = media
    .map((m) => ({ m, t: toTime(m.timestamp) }))
    .filter((x): x is { m: EngagementMediaInput; t: number } => x.t !== null && x.t <= cutoff)
    .sort((a, b) => b.t - a.t)
    .slice(0, ENGAGEMENT_SAMPLE_SIZE);
  const sample = oldEnough
    .filter((x) => isCount(x.m.like_count) && isCount(x.m.comments_count))
    .map((x) => x.m);
  return { sample, hiddenCounts: oldEnough.length - sample.length };
}

/** Posts per week across the sampled posts' time span (1 decimal). */
export function postsPerWeek(sample: readonly EngagementMediaInput[]): number | null {
  const times = sample.map((m) => toTime(m.timestamp)).filter((t): t is number => t !== null);
  if (times.length < 2) return null;
  const span = Math.max(...times) - Math.min(...times);
  if (span <= 0) return null;
  // n posts span n-1 intervals.
  return round((times.length - 1) / (span / WEEK_MS), 1);
}

/** Engagement = avg(likes + comments) of the sample ÷ followers × 100. */
export function computeEngagement(input: {
  followers: number | null | undefined;
  media: readonly EngagementMediaInput[];
  now?: Date;
}): EngagementComputation {
  const followers = Number(input.followers);
  if (!Number.isFinite(followers) || followers <= 0) {
    return { ok: false, error: ENGAGEMENT_ERRORS.noFollowers };
  }
  const { sample, hiddenCounts } = selectSample(input.media, input.now ?? new Date());
  if (sample.length === 0) {
    return {
      ok: false,
      error: hiddenCounts > 0 ? ENGAGEMENT_ERRORS.hiddenCounts : ENGAGEMENT_ERRORS.noPosts,
    };
  }
  const likes = sample.reduce((acc, m) => acc + (m.like_count ?? 0), 0);
  const comments = sample.reduce((acc, m) => acc + (m.comments_count ?? 0), 0);
  const avgLikes = likes / sample.length;
  const avgComments = comments / sample.length;
  return {
    ok: true,
    metrics: {
      followers,
      postsSampled: sample.length,
      avgLikes: round(avgLikes, 1),
      avgComments: round(avgComments, 1),
      engagementRate: round(((avgLikes + avgComments) / followers) * 100, 2),
      postsPerWeek: postsPerWeek(sample),
    },
  };
}

export function benchmarkTier(followers: number): EngagementBenchmarkTier {
  return (
    ENGAGEMENT_BENCHMARK_TIERS.find((t) => followers < t.maxFollowers) ??
    ENGAGEMENT_BENCHMARK_TIERS[ENGAGEMENT_BENCHMARK_TIERS.length - 1]
  );
}

/** "alto" / "medio" / "bajo" against the reference range of the follower tier. */
export function benchmarkLevel(rate: number, followers: number): EngagementLevel {
  const tier = benchmarkTier(followers);
  if (rate >= tier.high) return "alto";
  if (rate >= tier.medium) return "medio";
  return "bajo";
}

/**
 * Normalizes what people type as an Instagram handle: "@marca", a profile URL
 * or "marca/". Returns null when it is not a valid username.
 */
export function normalizeIgHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  const url = s.match(/instagram\.com\/([^/?#\s]+)/i);
  if (url) s = url[1];
  s = s.replace(/^@+/, "").replace(/\/+$/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : null;
}

/** True when a measurement taken at `measuredAt` is still within the cache window. */
export function isFresh(measuredAt: string | null | undefined, now: Date = new Date()): boolean {
  const t = toTime(measuredAt ?? null);
  if (t === null) return false;
  return now.getTime() - t < ENGAGEMENT_CACHE_HOURS * HOUR_MS;
}

/**
 * Business Discovery fails with these Graph codes when the handle does not
 * exist or is a personal/private account. Anything else is reported as-is.
 */
export function isDiscoveryNotMeasurable(code: number | null, subcode: number | null): boolean {
  return subcode === 2207013 || code === 110 || (code === 100 && subcode === 33);
}
