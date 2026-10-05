// Server-only: measures a client's Instagram engagement with the official
// Instagram Graph API (never scraping) and caches it in ig_engagement_snapshots.
//
//  - "own": the client's IG Business/Creator account is connected in
//    meta_accounts → read its own profile + media with its vaulted token.
//  - "discovery": not connected but the client has an instagram_handle → ask
//    Business Discovery through any IG business account connected in the same
//    org. Only public Business/Creator profiles can be read this way.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMetaToken } from "@/lib/meta/tokens.server";
import { graphUrl } from "@/lib/meta/version";
import {
  ENGAGEMENT_ERRORS,
  ENGAGEMENT_FETCH_LIMIT,
  computeEngagement,
  isDiscoveryNotMeasurable,
  isFresh,
  normalizeIgHandle,
  type EngagementMediaInput,
  type EngagementSnapshot,
  type EngagementSource,
} from "@/lib/instagram/engagement";

export const SNAPSHOTS_TABLE = "ig_engagement_snapshots";

type SnapshotFound = { status: "ok"; snapshot: EngagementSnapshot | null };
export type SnapshotRead = SnapshotFound | { status: "missing_table" };

const MEDIA_FIELDS = "like_count,comments_count,timestamp,media_type";
const GENERIC_GRAPH_ERROR = "Meta no respondió correctamente. Intenta más tarde.";

class GraphError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly subcode: number | null,
  ) {
    super(message);
    this.name = "GraphError";
  }
}

/** Like graph() in oauth.server but keeps the error code/subcode. */
async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${graphUrl(path)}?${qs}`);
  const body = (await res.json().catch(() => null)) as any;
  if (!res.ok || body?.error) {
    const err = body?.error ?? {};
    throw new GraphError(
      String(err.error_user_msg ?? err.message ?? GENERIC_GRAPH_ERROR),
      typeof err.code === "number" ? err.code : null,
      typeof err.error_subcode === "number" ? err.error_subcode : null,
    );
  }
  return body as T;
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205";
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapSnapshot(row: any): EngagementSnapshot {
  return {
    id: String(row.id),
    client_id: String(row.client_id),
    measured_at: String(row.measured_at),
    source: row.source === "discovery" ? "discovery" : "own",
    username: row.username ?? null,
    followers: num(row.followers),
    posts_sampled: num(row.posts_sampled),
    avg_likes: num(row.avg_likes),
    avg_comments: num(row.avg_comments),
    engagement_rate: num(row.engagement_rate),
    posts_per_week: num(row.posts_per_week),
    error: row.error ?? null,
  };
}

/** Latest stored measurement for a client (service role; caller checks access). */
export async function readLatestSnapshot(clientId: string): Promise<SnapshotRead> {
  const { data, error } = await (supabaseAdmin.from(SNAPSHOTS_TABLE as any) as any)
    .select("*")
    .eq("client_id", clientId)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (isMissingTable(error)) return { status: "missing_table" };
  if (error) {
    console.error("[ig-engagement] read failed", clientId, error.message);
    throw new Error("No se pudo leer el engagement guardado");
  }
  return { status: "ok", snapshot: data ? mapSnapshot(data) : null };
}

type Measurement = {
  source: EngagementSource;
  username: string | null;
  followers: number | null;
  media: EngagementMediaInput[];
};

function mapMedia(rows: any[]): EngagementMediaInput[] {
  return rows.map((m) => ({
    timestamp: m.timestamp ?? null,
    // Missing counters (hidden likes) stay undefined: never default to 0.
    like_count: typeof m.like_count === "number" ? m.like_count : null,
    comments_count: typeof m.comments_count === "number" ? m.comments_count : null,
  }));
}

async function measureOwn(igAccountId: string, token: string): Promise<Measurement> {
  const me = await graphGet<any>(igAccountId, {
    access_token: token,
    fields: `username,followers_count,media.limit(${ENGAGEMENT_FETCH_LIMIT}){${MEDIA_FIELDS}}`,
  });
  return {
    source: "own",
    username: me?.username ?? null,
    followers: num(me?.followers_count),
    media: mapMedia(me?.media?.data ?? []),
  };
}

async function measureDiscovery(
  viewerIgId: string,
  token: string,
  handle: string,
): Promise<Measurement> {
  const res = await graphGet<any>(viewerIgId, {
    access_token: token,
    fields: `business_discovery.username(${handle}){username,followers_count,media_count,media.limit(${ENGAGEMENT_FETCH_LIMIT}){${MEDIA_FIELDS}}}`,
  });
  const bd = res?.business_discovery;
  if (!bd) throw new GraphError(ENGAGEMENT_ERRORS.privateOrPersonal, null, 2207013);
  return {
    source: "discovery",
    username: bd.username ?? handle,
    followers: num(bd.followers_count),
    media: mapMedia(bd?.media?.data ?? []),
  };
}

/**
 * Any IG business account connected in the client's org (with a vaulted
 * token) to act as the Business Discovery "viewer".
 */
async function findOrgViewerAccount(
  orgId: string,
): Promise<{ igAccountId: string; token: string } | null> {
  const { data: clients, error: cErr } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("org_id", orgId);
  if (cErr) throw new Error("No se pudo buscar una cuenta de Instagram de la agencia");
  const ids = ((clients ?? []) as { id: string }[]).map((c) => c.id);
  if (ids.length === 0) return null;

  const { data: accounts, error: aErr } = await (supabaseAdmin.from("meta_accounts" as any) as any)
    .select("id,ig_account_id,connected")
    .in("client_id", ids)
    .not("ig_account_id", "is", null);
  if (aErr) throw new Error("No se pudo buscar una cuenta de Instagram de la agencia");

  const sorted = [...((accounts ?? []) as any[])].sort(
    (a, b) => Number(Boolean(b.connected)) - Number(Boolean(a.connected)),
  );
  for (const acc of sorted) {
    const token = await getMetaToken(String(acc.id));
    if (token) return { igAccountId: String(acc.ig_account_id), token };
  }
  return null;
}

type ClientIgContext = {
  orgId: string;
  handle: string | null;
  own: { igAccountId: string; token: string } | null;
};

async function loadClientContext(clientId: string): Promise<ClientIgContext> {
  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .select("org_id,instagram_handle")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !client) throw new Error("No se encontró el cliente");

  const { getClientMetaToken } = await import("@/lib/meta/clientToken.server");
  const found = await getClientMetaToken(clientId);
  const own =
    found?.account.ig_account_id && found.token
      ? { igAccountId: found.account.ig_account_id, token: found.token }
      : null;
  const row = client as { org_id: string; instagram_handle: string | null };
  return { orgId: row.org_id, handle: normalizeIgHandle(row.instagram_handle), own };
}

type SnapshotInsert = Omit<EngagementSnapshot, "id" | "measured_at">;

const NO_HANDLE =
  "El cliente no tiene cuenta de Instagram conectada ni un usuario de Instagram válido en su ficha.";
const NO_VIEWER =
  "Para medir perfiles no conectados se necesita al menos una cuenta de Instagram Business conectada en la agencia.";

type FetchOk = { ok: true; measurement: Measurement };
type FetchFailed = { ok: false; source: EngagementSource; error: string };
type FetchOutcome = FetchOk | FetchFailed;

/** Picks own account vs Business Discovery and calls Graph. Never throws Graph errors. */
async function fetchMeasurement(clientId: string, ctx: ClientIgContext): Promise<FetchOutcome> {
  const source: EngagementSource = ctx.own ? "own" : "discovery";
  try {
    if (ctx.own) {
      return { ok: true, measurement: await measureOwn(ctx.own.igAccountId, ctx.own.token) };
    }
    if (!ctx.handle) return { ok: false, source, error: NO_HANDLE };
    const viewer = await findOrgViewerAccount(ctx.orgId);
    if (!viewer) return { ok: false, source, error: NO_VIEWER };
    return {
      ok: true,
      measurement: await measureDiscovery(viewer.igAccountId, viewer.token, ctx.handle),
    };
  } catch (e) {
    console.error("[ig-engagement] graph failed", clientId, source, e);
    const notMeasurable =
      source === "discovery" &&
      e instanceof GraphError &&
      isDiscoveryNotMeasurable(e.code, e.subcode);
    if (notMeasurable) return { ok: false, source, error: ENGAGEMENT_ERRORS.privateOrPersonal };
    return {
      ok: false,
      source,
      error: e instanceof Error ? `Meta: ${e.message}` : GENERIC_GRAPH_ERROR,
    };
  }
}

async function measure(clientId: string): Promise<SnapshotInsert> {
  const ctx = await loadClientContext(clientId);
  const empty = {
    client_id: clientId,
    followers: null,
    posts_sampled: null,
    avg_likes: null,
    avg_comments: null,
    engagement_rate: null,
    posts_per_week: null,
  };

  const fetched = await fetchMeasurement(clientId, ctx);
  if (!fetched.ok) {
    return { ...empty, source: fetched.source, username: ctx.handle, error: fetched.error };
  }
  const { measurement } = fetched;
  const result = computeEngagement({ followers: measurement.followers, media: measurement.media });
  if (!result.ok) {
    return {
      ...empty,
      source: measurement.source,
      username: measurement.username,
      followers: measurement.followers,
      error: result.error,
    };
  }
  const m = result.metrics;
  return {
    client_id: clientId,
    source: measurement.source,
    username: measurement.username,
    followers: m.followers,
    posts_sampled: m.postsSampled,
    avg_likes: m.avgLikes,
    avg_comments: m.avgComments,
    engagement_rate: m.engagementRate,
    posts_per_week: m.postsPerWeek,
    error: null,
  };
}

export type RefreshOutcome =
  | { status: "missing_table" }
  | { status: "cached"; snapshot: EngagementSnapshot }
  | { status: "measured"; snapshot: EngagementSnapshot };

/**
 * Measures and stores a new snapshot unless a successful one is younger than
 * the cache window (12 h). Failed measurements are not cached so the editor
 * can retry after fixing the cause (e.g. connecting the account).
 */
export async function refreshEngagement(clientId: string): Promise<RefreshOutcome> {
  const latest = await readLatestSnapshot(clientId);
  if (latest.status === "missing_table") return latest;
  if (latest.snapshot && !latest.snapshot.error && isFresh(latest.snapshot.measured_at)) {
    return { status: "cached", snapshot: latest.snapshot };
  }

  const row = await measure(clientId);
  const { data, error } = await (supabaseAdmin.from(SNAPSHOTS_TABLE as any) as any)
    .insert(row)
    .select("*")
    .single();
  if (isMissingTable(error)) return { status: "missing_table" };
  if (error) {
    console.error("[ig-engagement] insert failed", clientId, error.message);
    throw new Error("No se pudo guardar la medición de engagement");
  }
  return { status: "measured", snapshot: mapSnapshot(data) };
}
