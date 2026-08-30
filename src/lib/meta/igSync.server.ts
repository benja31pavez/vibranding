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
  syncedAt: string;
  /** Informational note (e.g. the account has no published media). */
  note?: string;
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
  return { profile: true, mediaCount: res.mediaCount, syncedAt };
}

/**
 * Captures a synced version under `label`, refreshing an existing synced
 * version with the same label. Write-first: the new snapshot is fully stored
 * before the superseded one is retired, so an empty response or a Meta error
 * leaves the stored version intact.
 */
export async function captureOrRefreshSyncVersion(
  clientId: string,
  igAccountId: string,
  token: string,
  label: string,
): Promise<
  | { ok: false; reason: string; empty?: boolean }
  | { ok: true; versionId: string; label: string; mediaCount: number }
> {
  const clean = label.trim();
  const { data: existing } = await (
    supabaseAdmin.from("instagram_grid_versions" as any) as any
  )
    .select("id")
    .eq("client_id", clientId)
    .eq("label", clean)
    .eq("source", "sync")
    .maybeSingle();

  const stagingLabel = existing?.id
    ? `${clean} · sincronizando ${new Date().toISOString()}`
    : clean;
  const res = await captureInstagramVersion(clientId, igAccountId, token, stagingLabel);
  if (!res.ok || !existing?.id) return res;

  // The new snapshot is stored; only now retire the superseded one and take
  // over its label.
  await (supabaseAdmin.from("instagram_posts" as any) as any)
    .delete()
    .eq("version_id", existing.id)
    .eq("type", "current")
    .not("ig_media_id", "is", null);
  await (supabaseAdmin.from("instagram_grid_versions" as any) as any)
    .delete()
    .eq("id", existing.id);
  await (supabaseAdmin.from("instagram_grid_versions" as any) as any)
    .update({ label: clean })
    .eq("id", res.versionId);

  return { ...res, label: clean };
}






/**
 * Captures the real account state as a NEW locked grid version of the "Actual"
 * track. Never touches existing rows: past versions are a historical record,
 * and the manual "Propuesta" plan lives on a separate track.
 */
export async function captureInstagramVersion(
  clientId: string,
  igAccountId: string,
  token: string,
  label: string,
): Promise<
  | { ok: false; reason: string; empty?: boolean }
  | { ok: true; versionId: string; label: string; mediaCount: number }
> {
  const media = await fetchInstagramMedia(igAccountId, token, 50);
  if (media.length === 0) {
    return {
      ok: false,
      empty: true,
      reason: "La cuenta no tiene publicaciones. No se modificó nada.",
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
