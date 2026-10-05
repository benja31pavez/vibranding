// Server-only: incoming Instagram DMs land in the shared inbox so Instagram and
// WhatsApp share one funnel and one outcome selector.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dbError } from "@/lib/messaging/delivery";
import {
  bumpIgUnread,
  insertIgMessage,
  resolveIgAccount,
  upsertIgConversation,
} from "@/lib/instagram/automation.server";
import { runDmAutomation } from "@/lib/instagram/dmAutomation.server";

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: { type?: string }[];
  };
};

export async function handleIgMessage(igAccountId: string, event: MessagingEvent) {
  const resolved = await resolveIgAccount(igAccountId);
  if (!resolved) return { skipped: "no_account" as const };

  const msg = event.message;
  if (!msg) return { skipped: "not_a_message" as const };

  const senderId = event.sender?.id ? String(event.sender.id) : null;
  if (!senderId) return { skipped: "no_sender" as const };

  // Echoes are our own outbound messages replayed back to us.
  const isEcho = Boolean(msg.is_echo) || senderId === resolved.igAccountId;
  const contactId = isEcho ? String(event.recipient?.id ?? "") : senderId;
  if (!contactId) return { skipped: "no_contact" as const };

  const at = event.timestamp
    ? new Date(Number(event.timestamp)).toISOString()
    : new Date().toISOString();
  const body =
    msg.text ??
    (msg.attachments?.length ? `[${msg.attachments[0]?.type ?? "adjunto"}]` : null);

  // Idempotency: Meta redelivers the same mid when we answered non-200. If it
  // is already stored, skip everything (no second unread bump, no second DM).
  const mid = msg.mid ? String(msg.mid) : null;
  if (mid) {
    const { data: seen, error: seenError } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("id")
      .eq("wa_message_id", mid)
      .limit(1);
    if (seenError) throw dbError("handleIgMessage dedup", seenError);
    if (seen && seen.length > 0) return { skipped: "duplicate" as const };
  }

  // Find/create the conversation without touching unread_count: the bump
  // happens only after the message row (the idempotency key) is stored.
  const conversationId = await upsertIgConversation({
    clientId: resolved.clientId,
    igAccountId: resolved.igAccountId,
    contactId,
    username: null,
    preview: body?.slice(0, 120) ?? null,
    at,
    inbound: false,
    isLead: !isEcho,
  });
  if (!conversationId) return { skipped: "no_conversation" as const };

  const stored = await insertIgMessage({
    conversationId,
    clientId: resolved.clientId,
    messageId: mid,
    direction: isEcho ? "outbound" : "inbound",
    fromBot: false,
    body,
    at,
  });
  // Lost a race with a concurrent delivery of the same mid: it owns the reply.
  if (stored === "duplicate") return { skipped: "duplicate" as const };

  if (!isEcho) await bumpIgUnread(conversationId);

  if (!isEcho && !mid) {
    // Without a mid a redelivery cannot be told apart: never auto-reply twice.
    console.error("[ig-webhook] inbound DM without mid — automation skipped", conversationId);
    return { ok: true as const, conversationId };
  }

  if (!isEcho) {
    await runDmAutomation({
      clientId: resolved.clientId,
      igAccountId: resolved.igAccountId,
      token: resolved.token,
      conversationId,
      contactId,
      text: msg.text ?? null,
    });
  }

  return { ok: true as const, conversationId };
}
