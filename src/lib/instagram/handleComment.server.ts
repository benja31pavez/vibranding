// Server-only: one incoming Instagram comment -> matched trigger -> DM (+ reply).
// Every attempt is logged in ig_automation_events, which is also the
// idempotency guard against Meta's webhook retries.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  bumpTrigger,
  insertIgMessage,
  matchesTrigger,
  replyToComment,
  resolveIgAccount,
  sendPrivateReply,
  upsertIgConversation,
  type IgTrigger,
} from "@/lib/instagram/automation.server";

export type IncomingComment = {
  commentId: string;
  mediaId: string | null;
  text: string;
  fromId: string | null;
  fromUsername: string | null;
  at: string;
};

export async function handleIgComment(igAccountId: string, c: IncomingComment) {
  const resolved = await resolveIgAccount(igAccountId);
  if (!resolved) return { skipped: "no_account" as const };
  const { clientId, token } = resolved;

  // Claim the comment first: a duplicate webhook delivery hits the unique
  // index on comment_id and exits without sending a second DM.
  const { data: claim, error: claimError } = await supabaseAdmin
    .from("ig_automation_events")
    .insert({
      client_id: clientId,
      comment_id: c.commentId,
      ig_media_id: c.mediaId,
      commenter_id: c.fromId,
      commenter_username: c.fromUsername,
      comment_text: c.text?.slice(0, 1000) ?? null,
    })
    .select("id")
    .single();
  if (claimError || !claim?.id) return { skipped: "duplicate" as const };
  const eventId = claim.id as string;

  // Never automate the brand's own replies.
  if (c.fromId && c.fromId === resolved.igAccountId) {
    await supabaseAdmin.from("ig_automation_events").update({ matched: false }).eq("id", eventId);
    return { skipped: "self" as const };
  }

  const { data: triggerRows } = await supabaseAdmin
    .from("ig_comment_triggers")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  const triggers = ((triggerRows ?? []) as unknown as IgTrigger[]).filter(
    (t) => !t.ig_media_id || (c.mediaId && t.ig_media_id === c.mediaId),
  );
  // Post-specific triggers win over catch-all ones.
  triggers.sort((a, b) => Number(Boolean(b.ig_media_id)) - Number(Boolean(a.ig_media_id)));

  const trigger = triggers.find((t) => matchesTrigger(c.text ?? "", t));
  if (!trigger) {
    await supabaseAdmin.from("ig_automation_events").update({ matched: false }).eq("id", eventId);
    return { skipped: "no_match" as const };
  }

  await bumpTrigger(trigger.id, { triggered: 1 });

  // Private reply to the comment: the sanctioned comment-to-DM path. It does
  // not require an open 24h window, but it must target the comment id.
  const dm = await sendPrivateReply(resolved.igAccountId, token, c.commentId, trigger.dm_message);

  let conversationId: string | null = null;
  if (dm.ok && c.fromId) {
    conversationId = await upsertIgConversation({
      clientId,
      igAccountId: resolved.igAccountId,
      contactId: c.fromId,
      username: c.fromUsername,
      preview: trigger.dm_message.slice(0, 120),
      at: c.at,
      inbound: false,
      isLead: true,
    });
    if (conversationId) {
      await insertIgMessage({
        conversationId,
        clientId,
        messageId: null,
        direction: "outbound",
        fromBot: true,
        body: trigger.dm_message,
        at: c.at,
      });
    }
  }

  let replyStatus: "sent" | "failed" | "skipped" = "skipped";
  let replyError: string | null = null;
  if (trigger.public_reply?.trim()) {
    const r = await replyToComment(c.commentId, token, trigger.public_reply.trim());
    replyStatus = r.ok ? "sent" : "failed";
    replyError = r.ok ? null : r.error;
  }

  await supabaseAdmin
    .from("ig_automation_events")
    .update({
      trigger_id: trigger.id,
      matched: true,
      dm_status: dm.ok ? "sent" : "failed",
      dm_error: dm.ok ? null : dm.error,
      reply_status: replyStatus,
      reply_error: replyError,
      conversation_id: conversationId,
    })
    .eq("id", eventId);

  await bumpTrigger(trigger.id, dm.ok ? { sent: 1 } : { failed: 1 });

  return { matched: true as const, dmSent: dm.ok, triggerId: trigger.id };
}
