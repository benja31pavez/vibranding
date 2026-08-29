import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";

/**
 * Instagram webhook: `comments` for comment-to-DM automation and `messages`
 * for DMs that land in the shared inbox.
 *
 * Webhooks only fire against a reachable public URL, so the app must be
 * published; /admin/health surfaces that.
 */
export const Route = createFileRoute("/api/public/instagram/webhook")({
  server: {
    handlers: {
      // Meta verification handshake
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const expected = process.env.IG_WEBHOOK_VERIFY_TOKEN;
        if (!expected) {
          console.error("[ig webhook] IG_WEBHOOK_VERIFY_TOKEN missing");
          return new Response("Server misconfigured", { status: 500 });
        }
        if (
          url.searchParams.get("hub.mode") === "subscribe" &&
          url.searchParams.get("hub.verify_token") === expected
        ) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const appSecret = process.env.META_APP_SECRET;
        if (!appSecret) {
          console.error("[ig webhook] META_APP_SECRET missing — refusing unsigned payload");
          return new Response("Server misconfigured", { status: 500 });
        }

        const rawBody = await request.text();
        const header = request.headers.get("x-hub-signature-256") ?? "";
        const provided = header.startsWith("sha256=") ? header.slice(7).toLowerCase() : "";
        if (!provided) return new Response("Forbidden", { status: 403 });
        const expected = await hmacSha256Hex(appSecret, rawBody);
        if (!timingSafeEqualHex(provided, expected)) {
          console.error("[ig webhook] invalid signature");
          return new Response("Forbidden", { status: 403 });
        }

        let payload: any = null;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          payload = null;
        }
        if (!payload?.entry) return new Response("ok");

        const { handleIgComment } = await import("@/lib/instagram/handleComment.server");
        const { handleIgMessage } = await import("@/lib/instagram/handleMessage.server");

        for (const entry of payload.entry as any[]) {
          const igAccountId = String(entry.id ?? "");
          if (!igAccountId) continue;
          const at = entry.time
            ? new Date(Number(entry.time) * 1000).toISOString()
            : new Date().toISOString();

          for (const change of entry.changes ?? []) {
            if (change.field !== "comments") continue;
            const v = change.value ?? {};
            try {
              await handleIgComment(igAccountId, {
                commentId: String(v.id ?? ""),
                mediaId: v.media?.id ? String(v.media.id) : null,
                text: String(v.text ?? ""),
                fromId: v.from?.id ? String(v.from.id) : null,
                fromUsername: v.from?.username ?? null,
                at: v.timestamp ? new Date(v.timestamp).toISOString() : at,
              });
            } catch (err: any) {
              console.error("[ig webhook] comment handling failed", err?.message);
            }
          }

          for (const m of entry.messaging ?? []) {
            try {
              await handleIgMessage(igAccountId, m);
            } catch (err: any) {
              console.error("[ig webhook] message handling failed", err?.message);
            }
          }
        }

        // Always 200: Meta retries aggressively on anything else.
        return new Response("ok");
      },
    },
  },
});
