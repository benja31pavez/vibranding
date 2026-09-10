// Server-only: pulls the real Instagram account state (profile + published media)
// into the planning tables. Only ever writes `current_*` columns and
// `type = 'current'` rows — the proposed side is the agency's plan and is never
// touched here.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { graph } from "@/lib/meta/oauth.server";
import { STAGING_MARKER } from "@/lib/instagram/gridVersions";

export type IgMedia = {
  id: string;
  permalink: string | null;
  media_type: string | null;
  media_product_type: string | null;
  caption: string | null;
  timestamp: string | null;
  thumbnail: string | null;
  like_count: number;
};

export type IgSyncResult = {
  profile: boolean;
  mediaCount: number;
  syncedAt: string;
  /** Informational note (e.g. the account has no published media). */
  note?: string;
};

/** Graph returns at most 50 media per page; we never walk past this many. */
const MEDIA_PAGE = 50;
const MEDIA_CAP = 500;

const MEDIA_FIELDS =
  "id,permalink,media_type,media_product_type,caption,timestamp,media_url,thumbnail_url,like_count";

function formatOf(media: IgMedia): "photo" | "carousel" | "reel" {
  if (media.media_product_type === "REELS" || media.media_type === "VIDEO") return "reel";
  if (media.media_type === "CAROUSEL_ALBUM") return "carousel";
  return "photo";
}

function mapMedia(rows: any[]): IgMedia[] {
  return rows.map((m) => ({
    id: String(m.id),
    permalink: m.permalink ?? null,
    media_type: m.media_type ?? null,
    media_product_type: m.media_product_type ?? null,
    caption: m.caption ?? null,
    timestamp: m.timestamp ?? null,
    // Videos/reels only expose a still under thumbnail_url.
    thumbnail: m.thumbnail_url ?? m.media_url ?? null,
    like_count: Number(m.like_count) || 0,
  }));
}

/**
 * Reads published media from the connected IG account (newest first), following
 * the paging cursor until the account is exhausted or `cap` is reached.
 */
export async function fetchInstagramMediaPaged(
  igAccountId: string,
  token: string,
  cap = MEDIA_CAP,
): Promise<{ media: IgMedia[]; capped: boolean }> {
  const max = Math.min(Math.max(cap, 1), MEDIA_CAP);
  const out: IgMedia[] = [];
  let after: string | null = null;

  while (out.length < max) {
    const params: Record<string, string> = {
      access_token: token,
      fields: MEDIA_FIELDS,
      limit: String(Math.min(MEDIA_PAGE, max - out.length)),
    };
    if (after) params.after = after;

    const res = await graph<any>(`${igAccountId}/media`, params);
    const page = mapMedia((res?.data ?? []) as any[]);
    out.push(...page);

    after = res?.paging?.cursors?.after ?? null;
    if (page.length === 0 || !after || !res?.paging?.next) break;
  }

  return { media: out.slice(0, max), capped: out.length >= max };
}

/** Reads the most recent `limit` published media (newest first). */
export async function fetchInstagramMedia(
  igAccountId: string,
  token: string,
  limit = 30,
): Promise<IgMedia[]> {
  const { media } = await fetchInstagramMediaPaged(igAccountId, token, limit);
  return media;
}

/** Syncs followers/following/posts count/bio/avatar/link into `current_*`. */
export async function syncInstagramProfile(
  clientId: string,
  igAccountId: string,
  token: string,
  syncedAt: string,
): Promise<boolean> {
  const me = await graph<any>(igAccountId, {
    access_token: token,
    fields:
      "username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count",
  });

  const patch: Record<string, unknown> = {
    current_synced_at: syncedAt,
  };
  if (me.username) patch.current_username = String(me.username);
  if (me.name) patch.current_display_name = String(me.name);
  if (me.biography != null) patch.current_bio = String(me.biography) || null;
  if (me.website != null) patch.current_link = String(me.website) || null;
  if (me.profile_picture_url) patch.current_avatar_url = String(me.profile_picture_url);
  if (me.followers_count != null) patch.current_followers = Number(me.followers_count) || 0;
  if (me.follows_count != null) patch.current_following = Number(me.follows_count) || 0;
  if (me.media_count != null) patch.current_posts_count = Number(me.media_count) || 0;

  const { error } = await (supabaseAdmin.from("instagram_profiles" as any) as any)
    .update(patch)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
  return true;
}

/**
 * Full sync for one client: refreshes the live profile snapshot and stores the
 * real published grid as the current month's version of the "Actual" track.
 * It only ever reads and writes `type = 'current'` rows that carry an
 * `ig_media_id`, scoped to the version it creates. Manual uploads (the
 * "Propuesta" plan) and the historical baseline are never read or modified.
 */
export async function syncInstagramAccountData(
  clientId: string,
  igAccountId: string,
  token: string,
): Promise<IgSyncResult> {
  const { monthLabel } = await import("@/lib/instagram/gridVersions");
  const syncedAt = new Date().toISOString();
  const res = await captureOrRefreshSyncVersion(
    clientId,
    igAccountId,
    token,
    monthLabel(new Date()),
  );
  if (!res.ok) {
    return {
      profile: await syncInstagramProfile(clientId, igAccountId, token, syncedAt),
      mediaCount: 0,
      syncedAt,
      note: res.reason,
    };
  }
  return {
    profile: true,
    mediaCount: res.mediaCount,
    syncedAt,
    ...(res.note ? { note: res.note } : {}),
  };
}

export type CaptureResult =
  | { ok: false; reason: string; empty?: boolean }
  | {
      ok: true;
      versionId: string;
      label: string;
      mediaCount: number;
      isBaseline: boolean;
      replaced?: boolean;
      note?: string;
    };

/**
 * Audit trail: one row per sync attempt, readable from /admin/health. Never
 * throws — logging must not break a sync.
 */
async function logSyncRun(
  clientId: string,
  requestedLabel: string,
  res: CaptureResult,
) {
  try {
    await (supabaseAdmin.from("ig_sync_runs" as any) as any).insert(
      res.ok
        ? {
            client_id: clientId,
            status: "ok",
            requested_label: requestedLabel,
            persisted_label: res.label,
            version_id: res.versionId,
            media_count: res.mediaCount,
            swapped: res.replaced === true,
            is_baseline: res.isBaseline,
            note: res.note ?? null,
          }
        : {
            client_id: clientId,
            status: "error",
            requested_label: requestedLabel,
            error: res.reason,
          },
    );
  } catch {
    // ignored on purpose
  }
}


/** Staged versions left behind by an interrupted sync are never user content. */
async function dropStaleStagingVersions(clientId: string) {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: stale } = await (
    supabaseAdmin.from("instagram_grid_versions" as any) as any
  )
    .select("id")
    .eq("client_id", clientId)
    .lt("captured_at", cutoff)
    .like("label", `%${STAGING_MARKER}%`);
  const ids = ((stale ?? []) as any[]).map((r) => String(r.id));
  if (ids.length === 0) return;
  await (supabaseAdmin.from("instagram_posts" as any) as any)
    .delete()
    .in("version_id", ids);
  await (supabaseAdmin.from("instagram_grid_versions" as any) as any)
    .delete()
    .in("id", ids);
}

/**
 * Captures a synced version under `label`, refreshing an existing synced
 * version with the same label. Write-first: the new snapshot is fully stored
 * before the superseded one is retired (atomically, via
 * `ig_swap_sync_version`), so an empty response or a Meta error leaves the
 * stored version intact. The very first sync of a client becomes the baseline.
 */
export async function captureOrRefreshSyncVersion(
  clientId: string,
  igAccountId: string,
  token: string,
  label: string,
): Promise<CaptureResult> {
  const clean = label.trim();
  await dropStaleStagingVersions(clientId);

  // No version at all yet: this sync *is* the historical baseline.
  const { count: versionCount } = await (
    supabaseAdmin.from("instagram_grid_versions" as any) as any
  )
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  if ((versionCount ?? 0) === 0) {
    const first = await captureInstagramVersion(
      clientId,
      igAccountId,
      token,
      "Estado inicial",
      true,
    );
    if (first.ok) await markSynced(clientId);
    return first;
  }

  // A baseline exists and is never converted or overwritten.
  const { data: existing } = await (
    supabaseAdmin.from("instagram_grid_versions" as any) as any
  )
    .select("id")
    .eq("client_id", clientId)
    .eq("label", clean)
    .eq("source", "sync")
    .eq("is_baseline", false)
    .maybeSingle();

  const stagingLabel = existing?.id
    ? `${clean} ${STAGING_MARKER} ${new Date().toISOString()}`
    : clean;
  const res = await captureInstagramVersion(
    clientId,
    igAccountId,
    token,
    stagingLabel,
    false,
  );
  if (!res.ok) return res;

  if (!existing?.id) {
    await markSynced(clientId);
    return res;
  }

  // The new snapshot is stored; retire the superseded one and take over its
  // label in a single transaction. On failure the staged version is removed so
  // no "· sincronizando" label can survive.
  const { data: persisted, error: swapErr } = await (supabaseAdmin as any).rpc(
    "ig_swap_sync_version",
    { _new_id: res.versionId, _old_id: existing.id, _label: clean },
  );
  if (swapErr) {
    await (supabaseAdmin.from("instagram_posts" as any) as any)
      .delete()
      .eq("version_id", res.versionId);
    await (supabaseAdmin.from("instagram_grid_versions" as any) as any)
      .delete()
      .eq("id", res.versionId);
    return {
      ok: false,
      reason: `No se pudo reemplazar la versión "${clean}": ${swapErr.message}. Se mantuvo la versión anterior.`,
    };
  }

  await markSynced(clientId);
  // Report the label that is actually stored, not the one we intended.
  return { ...res, label: String(persisted ?? clean) };
}

/** Drives the setup step state from a timestamp, never from row counts. */
async function markSynced(clientId: string) {
  await (supabaseAdmin.from("meta_accounts" as any) as any)
    .update({ last_ig_sync_at: new Date().toISOString() })
    .eq("client_id", clientId);
}

/**
 * Captures the real account state as a NEW locked grid version of the "Actual"
 * track. Never touches existing rows: past versions are a historical record,
 * and the manual "Propuesta" plan lives on a separate track. An account with no
 * published media is a successful sync that stores an empty version.
 */
export async function captureInstagramVersion(
  clientId: string,
  igAccountId: string,
  token: string,
  label: string,
  isBaseline = false,
): Promise<CaptureResult> {
  const { media, capped } = await fetchInstagramMediaPaged(igAccountId, token, MEDIA_CAP);

  const me = await graph<any>(igAccountId, {
    access_token: token,
    fields: "followers_count,follows_count",
  });

  const capturedAt = new Date().toISOString();
  const { data: version, error: vErr } = await (
    supabaseAdmin.from("instagram_grid_versions" as any) as any
  )
    .insert({
      client_id: clientId,
      label: label.trim(),
      captured_at: capturedAt,
      source: "sync",
      is_baseline: isBaseline,
      followers: me?.followers_count != null ? Number(me.followers_count) : null,
      following: me?.follows_count != null ? Number(me.follows_count) : null,
    })
    .select("id,label")
    .single();
  if (vErr) {
    if (vErr.code === "23505" || /duplicate|unique/i.test(vErr.message)) {
      return {
        ok: false,
        reason: `Ya existe una versión llamada "${label.trim()}" para este cliente. Cámbiale el nombre.`,
      };
    }
    return { ok: false, reason: vErr.message };
  }

  const ordered = [...media].sort((a, b) =>
    (b.timestamp ?? "").localeCompare(a.timestamp ?? ""),
  );
  const payload = ordered.map((m, i) => ({
    client_id: clientId,
    type: "current" as const,
    version_id: version.id as string,
    position: i,
    ig_media_id: m.id,
    published_at: m.timestamp,
    image_url: m.thumbnail,
    cover_url: formatOf(m) === "reel" ? m.thumbnail : null,
    caption: m.caption,
    scheduled_at: m.timestamp,
    format: formatOf(m),
    likes_count: m.like_count,
    archived_at: null,
  }));

  if (payload.length > 0) {
    const { error } = await (supabaseAdmin.from("instagram_posts" as any) as any).insert(
      payload,
    );
    if (error) {
      await (supabaseAdmin.from("instagram_grid_versions" as any) as any)
        .delete()
        .eq("id", version.id);
      return { ok: false, reason: error.message };
    }
  }

  // Keep the live profile snapshot fresh too (current_* columns only).
  await syncInstagramProfile(clientId, igAccountId, token, capturedAt);

  const note = capped
    ? `Se trajeron las ${MEDIA_CAP} publicaciones más recientes (límite por sincronización).`
    : payload.length === 0
      ? "Sincronizado · la cuenta no tiene publicaciones"
      : undefined;

  return {
    ok: true,
    versionId: version.id as string,
    label: version.label as string,
    mediaCount: payload.length,
    isBaseline,
    ...(note ? { note } : {}),
  };
}
