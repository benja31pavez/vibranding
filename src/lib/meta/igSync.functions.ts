import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UnmatchedMedia = {
  id: string;
  permalink: string | null;
  mediaType: string | null;
  caption: string | null;
  timestamp: string | null;
  thumbnail: string | null;
};

/** Pulls the real profile + published media of the connected IG account. */
export const syncInstagramAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: owned } = await context.supabase
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a este cliente");

    const { getClientMetaToken } = await import("@/lib/meta/clientToken.server");
    const resolved = await getClientMetaToken(data.clientId);
    if (!resolved) {
      return {
        ok: false as const,
        reason:
          "Este cliente no tiene una cuenta de Meta conectada. Conéctala con OAuth o con un token de System User.",
      };
    }
    const { token, account } = resolved;
    if (!account.ig_account_id) {
      return {
        ok: false as const,
        reason: "Este cliente no tiene una cuenta de Instagram vinculada en Meta.",
      };
    }

    const { syncInstagramAccountData } = await import("@/lib/meta/igSync.server");
    const result = await syncInstagramAccountData(data.clientId, account.ig_account_id, token);
    return { ok: true as const, ...result };
  });

/** Recent published media not yet linked to any post of this client. */
export const listUnmatchedMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }): Promise<UnmatchedMedia[]> => {
    const { data: owned } = await context.supabase
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a este cliente");

    const { getClientMetaToken } = await import("@/lib/meta/clientToken.server");
    const found = await getClientMetaToken(data.clientId);
    if (!found?.account.ig_account_id) return [];

    const { fetchInstagramMedia } = await import("@/lib/meta/igSync.server");
    const media = await fetchInstagramMedia(
      found.account.ig_account_id,
      found.token,
      30,
    );

    const { data: used } = await (context.supabase.from("instagram_posts" as any) as any)
      .select("ig_media_id")
      .eq("client_id", data.clientId)
      .not("ig_media_id", "is", null);
    const usedIds = new Set(((used ?? []) as any[]).map((r) => String(r.ig_media_id)));

    return media
      .filter((m) => !usedIds.has(m.id))
      .map((m) => ({
        id: m.id,
        permalink: m.permalink,
        mediaType: m.media_product_type === "REELS" ? "REEL" : m.media_type,
        caption: m.caption,
        timestamp: m.timestamp,
        thumbnail: m.thumbnail,
      }));
  });

/** Links a planned post to a real published media (or unlinks it with null). */
export const matchPostToMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { clientId: string; postId: string; igMediaId: string | null }) => input,
  )
  .handler(async ({ data, context }) => {
    const { data: owned } = await context.supabase
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a este cliente");

    let publishedAt: string | null = null;
    if (data.igMediaId) {
      const { data: clash } = await (context.supabase.from("instagram_posts" as any) as any)
        .select("id")
        .eq("client_id", data.clientId)
        .eq("ig_media_id", data.igMediaId)
        .neq("id", data.postId)
        .maybeSingle();
      if (clash) throw new Error("Esa publicación ya está vinculada a otro post");

      const { getClientMetaToken } = await import("@/lib/meta/clientToken.server");
      const found = await getClientMetaToken(data.clientId);
      if (found?.account.ig_account_id) {
        const { fetchInstagramMedia } = await import("@/lib/meta/igSync.server");
        const media = await fetchInstagramMedia(
          found.account.ig_account_id,
          found.token,
          30,
        );
        publishedAt = media.find((m) => m.id === data.igMediaId)?.timestamp ?? null;
      }
    }

    const { error } = await (context.supabase.from("instagram_posts" as any) as any)
      .update({ ig_media_id: data.igMediaId, published_at: publishedAt })
      .eq("id", data.postId)
      .eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true, publishedAt };
  });

/** Captures the real account state as a new locked grid version. */
export const captureInstagramGridVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; label: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: owned } = await context.supabase
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a este cliente");

    const { getClientMetaToken } = await import("@/lib/meta/clientToken.server");
    const resolved = await getClientMetaToken(data.clientId);
    if (!resolved) {
      return {
        ok: false as const,
        reason:
          "Este cliente no tiene una cuenta de Meta conectada. Usa \"Subir manualmente\" o conecta la cuenta.",
      };
    }
    if (!resolved.account.ig_account_id) {
      return {
        ok: false as const,
        reason: "Este cliente no tiene una cuenta de Instagram vinculada en Meta.",
      };
    }

    const { captureInstagramVersion } = await import("@/lib/meta/igSync.server");
    return await captureInstagramVersion(
      data.clientId,
      resolved.account.ig_account_id,
      resolved.token,
      data.label,
    );
  });
