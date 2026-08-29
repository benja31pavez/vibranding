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
 * Replaces the manually uploaded `current` grid with the real published media.
 * Rows with `type = 'proposed'` are never read or written here.
 */
export async function syncInstagramMedia(
  clientId: string,
  media: IgMedia[],
): Promise<{ mediaCount: number; removedManual: number }> {
  // Manually uploaded "actual" rows (no ig_media_id) are superseded by real data.
  const { data: removed } = await (supabaseAdmin.from("instagram_posts" as any) as any)
    .delete()
    .eq("client_id", clientId)
    .eq("type", "current")
    .is("ig_media_id", null)
    .select("id");

  if (media.length === 0) {
    return { mediaCount: 0, removedManual: (removed ?? []).length };
  }

  // Newest first, so position 0 matches the top-left cell of the real grid.
  const ordered = [...media].sort((a, b) =>
    (b.timestamp ?? "").localeCompare(a.timestamp ?? ""),
  );

  // A media already matched to a proposed row keeps that row: move it to current
  // is wrong (it would erase the plan), so we only claim ids not already used
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
    }));

  if (payload.length > 0) {
    const { error } = await (supabaseAdmin.from("instagram_posts" as any) as any).upsert(
      payload,
      { onConflict: "client_id,ig_media_id" },
    );
    if (error) throw new Error(error.message);
  }

  return { mediaCount: payload.length, removedManual: (removed ?? []).length };
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
