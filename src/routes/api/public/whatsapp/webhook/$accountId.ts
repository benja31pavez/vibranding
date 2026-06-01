import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ruleToActions, sendBotActions } from "@/lib/whatsapp/sendActions";

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

        const { data: acc } = await supabaseAdmin
          .from("whatsapp_accounts")
          .select("verify_token")
          .eq("id", params.accountId)
          .maybeSingle();

        if (mode === "subscribe" && acc?.verify_token && token === acc.verify_token) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      // Inbound messages from Meta
      POST: async ({ request, params }) => {
        const accountId = params.accountId;
        const payload: any = await request.json().catch(() => null);
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
              if (matched && matchedActions.length > 0 && acc.phone_number_id && acc.access_token) {
                const results = await sendBotActions(
                  acc.phone_number_id,
                  acc.access_token,
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
