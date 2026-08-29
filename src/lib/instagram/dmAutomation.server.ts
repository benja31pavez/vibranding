// Server-only: automatic replies to incoming Instagram direct messages.
// Two compliant triggers are supported:
//  - keyword: an inbound DM containing a keyword fires a reply
//  - welcome: the first inbound DM of a conversation fires a greeting
// Both reply inside the 24-hour standard messaging window opened by the user's
// own message, so no private-reply permission is needed.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  insertIgMessage,
  matchesTrigger,
  sendIgDirectMessage,
  type IgTrigger,
} from "@/lib/instagram/automation.server";

type DmTrigger = {
  id: string;
  kind: "keyword" | "welcome";
  keywords: string[];
  match_type: IgTrigger["match_type"];
  message: string;
  priority: number;
};

async function bump(triggerId: string, sent: boolean) {
  await (supabaseAdmin.rpc as any)("ig_dm_trigger_bump", {
    _trigger_id: triggerId,
    _triggered: 1,
    _sent: sent ? 1 : 0,
    _failed: sent ? 0 : 1,
  });
}

/** Returns the trigger that should answer this inbound DM, if any. */
async function pickTrigger(
  clientId: string,
  text: string | null,
  isFirstMessage: boolean,
): Promise<DmTrigger | null> {
  const { data } = await (supabaseAdmin.from("ig_dm_triggers" as any) as any)
    .select("id,kind,keywords,match_type,message,priority")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("priority", { ascending: false });
  const rows = (data ?? []) as DmTrigger[];

  if (text) {
    const kw = rows.find(
      (r) =>
        r.kind === "keyword" &&
        matchesTrigger(text, {
          keywords: r.keywords,
          match_type: r.match_type,
        } as IgTrigger),
    );
    if (kw) return kw;
  }
  if (isFirstMessage) return rows.find((r) => r.kind === "welcome") ?? null;
  return null;
}

export async function runDmAutomation(args: {
  clientId: string;
  igAccountId: string;
  token: string;
  conversationId: string;
  contactId: string;
  text: string | null;
}) {
  const { data: conv } = await supabaseAdmin
    .from("whatsapp_conversations")
    .select("welcome_sent_at,ai_paused,needs_human_followup")
    .eq("id", args.conversationId)
    .maybeSingle();

  // A human took over: never talk on top of them.
  if ((conv as any)?.ai_paused || (conv as any)?.needs_human_followup)
    return { skipped: "handoff" as const };

  const isFirstMessage = !(conv as any)?.welcome_sent_at;
  const trigger = await pickTrigger(args.clientId, args.text, isFirstMessage);
  if (!trigger) return { skipped: "no_trigger" as const };

  const res = await sendIgDirectMessage(
    args.igAccountId,
    args.token,
    args.contactId,
    trigger.message,
  );
  await bump(trigger.id, res.ok);

  if (!res.ok) return { ok: false as const, error: res.error };

  await insertIgMessage({
    conversationId: args.conversationId,
    clientId: args.clientId,
    messageId: null,
    direction: "outbound",
    fromBot: true,
    body: trigger.message,
    at: new Date().toISOString(),
  });

  await supabaseAdmin
    .from("whatsapp_conversations")
    .update({
      welcome_sent_at: (conv as any)?.welcome_sent_at ?? new Date().toISOString(),
      last_message_preview: trigger.message.slice(0, 120),
      last_message_at: new Date().toISOString(),
    })
    .eq("id", args.conversationId);

  return { ok: true as const, triggerId: trigger.id };
}
