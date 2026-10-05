// Server-only: Instagram comment-to-DM automation.
// Uses the Instagram Messaging API through the Graph endpoint of the connected
// IG professional account. Tokens come from Vault (per client or per org).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { graphUrl } from "@/lib/meta/version";
import { getMetaToken } from "@/lib/meta/tokens.server";
import { classifyInsert, type InsertOutcome } from "@/lib/messaging/delivery";

export type IgTrigger = {
  id: string;
  client_id: string;
  ig_media_id: string | null;
  keywords: string[];
  match_type: "keyword" | "exact" | "starts_with" | "any";
  dm_message: string;
  public_reply: string | null;
  is_active: boolean;
  priority: number;
};

/** Standard (non-private-reply) messaging is only allowed for 24h. */
export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

function normalize(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function matchesTrigger(text: string, t: IgTrigger): boolean {
  const value = normalize(text);
  const kws = (t.keywords ?? []).map(normalize).filter(Boolean);
  switch (t.match_type) {
    case "any":
      return true;
    case "exact":
      return kws.some((k) => k === value);
    case "starts_with":
      return kws.some((k) => value.startsWith(k));
    case "keyword":
    default:
      return kws.some((k) => value.includes(k));
  }
}

/** Resolves the client + token for an incoming IG account id (webhook entry id). */
export async function resolveIgAccount(igAccountId: string) {
  const { data: account, error } = await (supabaseAdmin.from("meta_accounts" as any) as any)
    .select("id,client_id,ig_account_id,page_id")
    .eq("ig_account_id", igAccountId)
    .maybeSingle();
  // A DB error is not "unknown account": throw so the webhook asks for a retry.
  if (error) throw new Error(`resolveIgAccount: ${error.message}`);
  if (!account?.id) return null;
  const token = await getMetaToken(account.id);
  if (!token) return null;
  return {
    token: token as string,
    metaAccountId: account.id as string,
    clientId: account.client_id as string,
    igAccountId: account.ig_account_id as string,
  };
}

async function graphPost(path: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(graphUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = json?.error?.message ?? `HTTP ${res.status}`;
    return { ok: false as const, error: String(detail).slice(0, 500) };
  }
  return { ok: true as const, data: json };
}

/**
 * Private reply to a comment. This is the sanctioned comment-to-DM path and
 * opens the conversation without needing an existing 24h window.
 */
export function sendPrivateReply(
  igAccountId: string,
  token: string,
  commentId: string,
  text: string,
) {
  return graphPost(`${igAccountId}/messages`, token, {
    recipient: { comment_id: commentId },
    message: { text },
  });
}

/** Standard DM to a user id — only valid inside the 24-hour window. */
export function sendIgDirectMessage(
  igAccountId: string,
  token: string,
  igUserId: string,
  text: string,
) {
  return graphPost(`${igAccountId}/messages`, token, {
    recipient: { id: igUserId },
    message: { text },
  });
}

export function replyToComment(commentId: string, token: string, text: string) {
  return graphPost(`${commentId}/replies`, token, { message: text });
}

/**
 * Instagram DMs live in the same inbox as WhatsApp: one row in
 * whatsapp_conversations with channel='instagram', so the funnel and the
 * outcome selector are shared.
 */
export async function upsertIgConversation(args: {
  clientId: string;
  igAccountId: string;
  contactId: string;
  username: string | null;
  preview: string | null;
  at: string;
  inbound: boolean;
  isLead?: boolean;
}) {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("whatsapp_conversations")
    .select("id,unread_count")
    .eq("client_id", args.clientId)
    .eq("channel", "instagram")
    .eq("contact_wa_id", args.contactId)
    .maybeSingle();
  if (findError) throw new Error(`upsertIgConversation select: ${findError.message}`);

  if (existing?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("whatsapp_conversations")
      .update({
        contact_name: args.username ?? undefined,
        contact_username: args.username ?? undefined,
        last_message_at: args.at,
        last_message_preview: args.preview,
        unread_count: args.inbound ? (existing.unread_count ?? 0) + 1 : existing.unread_count,
        status: "open",
        ...(args.isLead ? { is_lead: true } : {}),
      })
      .eq("id", existing.id);
    if (updateError) throw new Error(`upsertIgConversation update: ${updateError.message}`);
    return existing.id as string;
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from("whatsapp_conversations")
    .insert({
      client_id: args.clientId,
      account_id: null,
      channel: "instagram",
      ig_account_id: args.igAccountId,
      contact_wa_id: args.contactId,
      contact_name: args.username,
      contact_username: args.username,
      last_message_at: args.at,
      last_message_preview: args.preview,
      unread_count: args.inbound ? 1 : 0,
      status: "open",
      is_lead: args.isLead ?? false,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(`upsertIgConversation insert: ${insertError.message}`);
  return (created?.id as string) ?? null;
}

export async function insertIgMessage(args: {
  conversationId: string;
  clientId: string;
  messageId: string | null;
  direction: "inbound" | "outbound";
  fromBot: boolean;
  body: string | null;
  at: string;
}): Promise<InsertOutcome> {
  // A repeated Meta mid hits idx_wa_msg_waid (unique on wa_message_id) and
  // comes back as "duplicate"; any other DB error throws.
  const { error } = await supabaseAdmin.from("whatsapp_messages").insert({
    conversation_id: args.conversationId,
    client_id: args.clientId,
    channel: "instagram",
    wa_message_id: args.messageId,
    direction: args.direction,
    from_bot: args.fromBot,
    type: "text",
    body: args.body,
    timestamp: args.at,
  });
  return classifyInsert(error, "insertIgMessage");
}

/** True when the contact wrote within the last 24 hours. */
export async function withinMessagingWindow(conversationId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("timestamp")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .order("timestamp", { ascending: false })
    .limit(1);
  const last = data?.[0]?.timestamp;
  if (!last) return false;
  return Date.now() - new Date(last).getTime() < MESSAGING_WINDOW_MS;
}

export async function bumpTrigger(
  triggerId: string,
  counts: { triggered?: number; sent?: number; failed?: number },
) {
  await (supabaseAdmin.rpc as any)("ig_trigger_bump", {
    _trigger_id: triggerId,
    _triggered: counts.triggered ?? 0,
    _sent: counts.sent ?? 0,
    _failed: counts.failed ?? 0,
  });
}
