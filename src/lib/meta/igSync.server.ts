// Server-only: pulls the real Instagram account state (profile + published media)
// into the planning tables. Only ever writes `current_*` columns and
// `type = 'current'` rows — the proposed side is the agency's plan and is never
// touched here.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { graph } from "@/lib/meta/oauth.server";

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
  archivedManual: number;
  syncedAt: string;
  warning?: string;
};


function formatOf(media: IgMedia): "photo" | "carousel" | "reel" {
  if (media.media_product_type === "REELS" || media.media_type === "VIDEO") return "reel";
  if (media.media_type === "CAROUSEL_ALBUM") return "carousel";
  return "photo";
}

/** Reads recent published media from the connected IG account (newest first). */
export async function fetchInstagramMedia(
  igAccountId: string,
  token: string,
  limit = 30,
): Promise<IgMedia[]> {
  const res = await graph<any>(`${igAccountId}/media`, {
    access_token: token,
    fields:
      "id,permalink,media_type,media_product_type,caption,timestamp,media_url,thumbnail_url,like_count",
    limit: String(Math.min(Math.max(limit, 1), 50)),
  });
  return ((res?.data ?? []) as any[]).map((m) => ({
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
 * Writes the real published media first and only archives superseded manual
 * rows afterwards, so a failed write can never destroy the manual grid.
 * Rows with `type = 'proposed'` are never read or written here.
 */
export async function syncInstagramMedia(
  clientId: string,
  media: IgMedia[],
): Promise<{ mediaCount: number; archivedManual: number; warning?: string }> {
  if (media.length === 0) {
    return {
      mediaCount: 0,
      archivedManual: 0,
      warning:
        "Meta no devolvió publicaciones. No se modificó nada de tu grilla manual.",
    };
  }

  // Newest first, so position 0 matches the top-left cell of the real grid.
  const ordered = [...media].sort((a, b) =>
    (b.timestamp ?? "").localeCompare(a.timestamp ?? ""),
  );

  // A media already matched to a proposed row keeps that row: moving it to
  // current would erase the plan, so we only claim ids not already used
  // by a proposed row.
  const { data: claimed } = await (supabaseAdmin.from("instagram_posts" as any) as any)
    .select("ig_media_id")
    .eq("client_id", clientId)
    .eq("type", "proposed")
    .not("ig_media_id", "is", null);
  const claimedIds = new Set(
    ((claimed ?? []) as any[]).map((r) => String(r.ig_media_id)),
  );

  const payload = ordered
    .filter((m) => !claimedIds.has(m.id))
    .map((m, i) => ({
      client_id: clientId,
      type: "current" as const,
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

  if (payload.length === 0) {
    return {
      mediaCount: 0,
      archivedManual: 0,
      warning:
        "Todas las publicaciones reales ya están vinculadas a posts propuestos. No se archivó nada.",
    };
  }

  // 1) Write first. If this fails we throw and the manual rows stay intact.
  const { error } = await (supabaseAdmin.from("instagram_posts" as any) as any).upsert(
    payload,
    { onConflict: "client_id,ig_media_id" },
  );
  if (error) throw new Error(error.message);

  // 2) Only now archive the manually uploaded "actual" rows (reversible).
  const { data: archived } = await (supabaseAdmin.from("instagram_posts" as any) as any)
    .update({ archived_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("type", "current")
    .is("ig_media_id", null)
    .is("archived_at", null)
    .select("id");

  return { mediaCount: payload.length, archivedManual: (archived ?? []).length };
}

/** Full sync for one client: real profile + real published grid. */
export async function syncInstagramAccountData(
  clientId: string,
  igAccountId: string,
  token: string,
): Promise<IgSyncResult> {
  const syncedAt = new Date().toISOString();
  const media = await fetchInstagramMedia(igAccountId, token);
  const counts = await syncInstagramMedia(clientId, media);
  const profile = await syncInstagramProfile(clientId, igAccountId, token, syncedAt);
  return { profile, ...counts, syncedAt };
}


/**
 * Captures the account state as a NEW immutable grid version. Never touches
 * existing rows: past versions are a historical record.
 */
export async function captureInstagramVersion(
  clientId: string,
  igAccountId: string,
  token: string,
  label: string,
): Promise<
  | { ok: false; reason: string }
  | { ok: true; versionId: string; label: string; mediaCount: number }
> {
  const media = await fetchInstagramMedia(igAccountId, token, 50);
  if (media.length === 0) {
    return {
      ok: false,
      reason:
        "Meta no devolvió publicaciones para esta cuenta, así que no se creó ninguna versión.",
    };
  }

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

  const { error } = await (supabaseAdmin.from("instagram_posts" as any) as any).insert(
    payload,
  );
  if (error) {
    await (supabaseAdmin.from("instagram_grid_versions" as any) as any)
      .delete()
      .eq("id", version.id);
    return { ok: false, reason: error.message };
  }

  // Keep the live profile snapshot fresh too (current_* columns only).
  await syncInstagramProfile(clientId, igAccountId, token, capturedAt);

  return {
    ok: true,
    versionId: version.id as string,
    label: version.label as string,
    mediaCount: payload.length,
  };
}
