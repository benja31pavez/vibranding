import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ruleToActions, sendBotActions } from "@/lib/whatsapp/sendActions";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import { getWaSecret } from "@/lib/whatsapp/tokens.server";

function normalize(s: string): string {
  return (s ?? "").toLowerCase().trim();
}

function matchRule(text: string, rule: any): boolean {
  const t = normalize(text);
  const kws: string[] = (rule.keywords ?? []).map((k: string) => normalize(k));
  switch (rule.match_type) {
    case "exact":
      return kws.some((k) => k === t);
    case "starts_with":
      return kws.some((k) => k.length > 0 && t.startsWith(k));
    case "keyword":
      return kws.some((k) => k.length > 0 && t.includes(k));
    case "fallback":
      return true;
    default:
      return false;
  }
}


export const Route = createFileRoute("/api/public/whatsapp/webhook/$accountId")({
  server: {
    handlers: {
      // Meta verification handshake
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const expectedToken = await getWaSecret(params.accountId, "verify_token");

        if (mode === "subscribe" && expectedToken && token === expectedToken) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      // Inbound messages from Meta
      POST: async ({ request, params }) => {
        const accountId = params.accountId;

        // Verify Meta's X-Hub-Signature-256 over the RAW body before doing anything.
        const appSecret = process.env.META_APP_SECRET;
        if (!appSecret) {
          console.error(
            "[whatsapp webhook] META_APP_SECRET missing — rejecting request instead of trusting unsigned payload",
          );
          return new Response("Server misconfigured", { status: 500 });
        }

        const rawBody = await request.text();
        const header = request.headers.get("x-hub-signature-256") ?? "";
        const provided = header.startsWith("sha256=") ? header.slice(7).toLowerCase() : "";
        if (!provided) {
          console.error("[whatsapp webhook] missing X-Hub-Signature-256");
          return new Response("Forbidden", { status: 403 });
        }
        const expected = await hmacSha256Hex(appSecret, rawBody);
        if (!timingSafeEqualHex(provided, expected)) {
          console.error("[whatsapp webhook] invalid signature");
          return new Response("Forbidden", { status: 403 });
        }

        let payload: any = null;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          payload = null;
        }
        if (!payload) return new Response("ok");

        const { data: acc } = await supabaseAdmin
          .from("whatsapp_accounts")
          .select("*")
          .eq("id", accountId)
          .maybeSingle();
        if (!acc) return new Response("ok");

        const entries: any[] = payload.entry ?? [];
        for (const entry of entries) {
          for (const change of entry.changes ?? []) {
            const value = change.value ?? {};
            const contacts = value.contacts ?? [];
            const messages = value.messages ?? [];
            const statuses = value.statuses ?? [];

            // Delivery status updates
            for (const st of statuses) {
              if (st.id) {
                await supabaseAdmin
                  .from("whatsapp_messages")
                  .update({ status: st.status })
                  .eq("wa_message_id", st.id);
              }
            }

            for (const msg of messages) {
              const from = msg.from as string;
              const waMsgId = msg.id as string;
              const ts = msg.timestamp
                ? new Date(Number(msg.timestamp) * 1000).toISOString()
                : new Date().toISOString();
              const contactName =
                contacts.find((c: any) => c.wa_id === from)?.profile?.name ?? null;

              const type = msg.type as string;
              let body = "";
              let mediaUrl: string | null = null;
              if (type === "text") body = msg.text?.body ?? "";
              else if (type === "button") body = msg.button?.text ?? "";
              else if (type === "interactive")
                body =
                  msg.interactive?.button_reply?.title ??
                  msg.interactive?.list_reply?.title ??
                  "";
              else body = `[${type}]`;

              // Upsert conversation
              const { data: existing } = await supabaseAdmin
                .from("whatsapp_conversations")
                .select("*")
                .eq("account_id", accountId)
                .eq("contact_wa_id", from)
                .maybeSingle();

              let conversationId: string;
              let aiPaused = false;
              if (existing) {
                conversationId = existing.id;
                aiPaused = !!existing.ai_paused;
                await supabaseAdmin
                  .from("whatsapp_conversations")
                  .update({
                    contact_name: contactName ?? existing.contact_name,
                    last_message_at: ts,
                    last_message_preview: body.slice(0, 140),
                    unread_count: (existing.unread_count ?? 0) + 1,
                    status: "open",
                  })
                  .eq("id", conversationId);
              } else {
                const { data: created } = await supabaseAdmin
                  .from("whatsapp_conversations")
                  .insert({
                    client_id: acc.client_id,
                    account_id: accountId,
                    contact_wa_id: from,
                    contact_name: contactName,
                    last_message_at: ts,
                    last_message_preview: body.slice(0, 140),
                    unread_count: 1,
                    status: "open",
                  })
                  .select("id")
                  .single();
                conversationId = created!.id;
              }

              // Click-to-WhatsApp attribution: Meta sends the ad referral on the
              // first message of a conversation started from an ad.
              const referral = msg.referral ?? value.referral ?? null;
              const ctwaClid = referral?.ctwa_clid ?? null;
              if (ctwaClid) {
                const { error: attrError } = await (
                  supabaseAdmin.from("attributions" as any) as any
                ).upsert(
                  {
                    client_id: acc.client_id,
                    ctwa_clid: String(ctwaClid),
                    conversation_id: conversationId,
                    ad_id: referral?.source_id ? String(referral.source_id) : null,
                    headline: referral?.headline ?? null,
                    source_url: referral?.source_url ?? null,
                    source_type: referral?.source_type ?? null,
                    first_seen_at: ts,
                  },
                  { onConflict: "client_id,ctwa_clid", ignoreDuplicates: true },
                );
                if (attrError) {
                  console.error("[whatsapp webhook] attribution insert failed", attrError.message);
                }
              }

              // Insert inbound message

              await supabaseAdmin.from("whatsapp_messages").insert({
                conversation_id: conversationId,
                client_id: acc.client_id,
                wa_message_id: waMsgId,
                direction: "inbound",
                from_bot: false,
                type,
                body,
                media_url: mediaUrl,
                timestamp: ts,
                status: "received",
              });

              // 1) Try keyword rules first (instant response)
              const { data: rules } = await supabaseAdmin
                .from("whatsapp_bot_rules")
                .select("*")
                .eq("client_id", acc.client_id)
                .eq("is_active", true)
                .order("priority", { ascending: false });

              const sorted = (rules ?? []).slice().sort((a, b) => {
                if (a.match_type === "fallback" && b.match_type !== "fallback") return 1;
                if (b.match_type === "fallback" && a.match_type !== "fallback") return -1;
                return 0;
              });
              // Skip fallback at this stage if AI is enabled — AI handles fallback
              const ruleCandidates = acc.ai_enabled
                ? sorted.filter((r) => r.match_type !== "fallback")
                : sorted;

              const matched = !aiPaused ? ruleCandidates.find((r) => matchRule(body, r)) : undefined;

              const matchedActions = matched ? ruleToActions(matched) : [];
              const accessToken =
                matched && matchedActions.length > 0 && acc.phone_number_id
                  ? await getWaSecret(acc.id, "access_token")
                  : null;
              if (matched && matchedActions.length > 0 && acc.phone_number_id && accessToken) {
                const results = await sendBotActions(
                  acc.phone_number_id,
                  accessToken,
                  from,
                  matchedActions,
                );
                let lastPreview = "";
                for (const r of results) {
                  lastPreview = r.preview;
                  await supabaseAdmin.from("whatsapp_messages").insert({
                    conversation_id: conversationId,
                    client_id: acc.client_id,
                    wa_message_id: r.wa_id ?? null,
                    direction: "outbound",
                    from_bot: true,
                    type: r.type,
                    body: r.preview,
                    timestamp: new Date().toISOString(),
                    status: r.ok ? "sent" : "failed",
                  });
                }
                await supabaseAdmin
                  .from("whatsapp_conversations")
                  .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: lastPreview.slice(0, 140),
                    is_lead: matched.mark_as_lead ? true : undefined,
                    pending_response_at: null,
                    last_bot_at: new Date().toISOString(),
                  })
                  .eq("id", conversationId);
              } else if (acc.ai_enabled && !aiPaused) {
                // 2) Schedule AI reply with debounce. Each new message extends the deadline.
                const debounce = Math.max(15, acc.ai_debounce_seconds ?? 75);
                const dueAt = new Date(Date.now() + debounce * 1000).toISOString();
                await supabaseAdmin
                  .from("whatsapp_conversations")
                  .update({ pending_response_at: dueAt })
                  .eq("id", conversationId);
              }
            }
          }
        }
        return new Response("ok");
      },
    },
  },
});
