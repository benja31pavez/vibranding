// Server-only: incoming Instagram DMs land in the shared inbox so Instagram and
// WhatsApp share one funnel and one outcome selector.
import {
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

  const conversationId = await upsertIgConversation({
    clientId: resolved.clientId,
    igAccountId: resolved.igAccountId,
    contactId,
    username: null,
    preview: body?.slice(0, 120) ?? null,
    at,
    inbound: !isEcho,
    isLead: !isEcho,
  });
  if (!conversationId) return { skipped: "no_conversation" as const };

  await insertIgMessage({
    conversationId,
    clientId: resolved.clientId,
    messageId: msg.mid ?? null,
    direction: isEcho ? "outbound" : "inbound",
    fromBot: false,
    body,
    at,
  });

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
