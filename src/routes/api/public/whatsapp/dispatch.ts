import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const META = "https://graph.facebook.com/v21.0";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type WAAccount = {
  id: string;
  client_id: string;
  phone_number_id: string | null;
  access_token: string | null;
  ai_enabled: boolean;
  ai_system_prompt: string;
  ai_model: string;
  ai_max_history: number;
  ai_business_context: string | null;
  website_url: string | null;
  social_links: { label: string; url: string }[] | null;
  catalog: { name: string; price?: string; url?: string; image_url?: string }[] | null;
};

async function sendWhatsApp(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  body: string,
): Promise<{ ok: boolean; wa_id?: string; error?: string }> {
  try {
    const res = await fetch(`${META}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });
    const data: any = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.message ?? "error" };
    return { ok: true, wa_id: data?.messages?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "fetch failed" };
  }
}

async function callAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ ok: boolean; text?: string; error?: string; status?: number }> {
  try {
    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...history],
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: txt };
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return { ok: true, text };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "fetch failed" };
  }
}

async function processConversation(convId: string) {
  const { data: conv } = await supabaseAdmin
    .from("whatsapp_conversations")
    .select("*")
    .eq("id", convId)
    .maybeSingle();
  if (!conv) return;
  if (conv.ai_paused) {
    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({ pending_response_at: null })
      .eq("id", convId);
    return;
  }
  if (!conv.pending_response_at || new Date(conv.pending_response_at) > new Date()) {
    return;
  }

  const { data: acc } = await supabaseAdmin
    .from("whatsapp_accounts")
    .select(
      "id,client_id,phone_number_id,access_token,ai_enabled,ai_system_prompt,ai_model,ai_max_history,ai_business_context",
    )
    .eq("id", conv.account_id)
    .maybeSingle<WAAccount>();
  if (!acc || !acc.ai_enabled || !acc.phone_number_id || !acc.access_token) {
    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({ pending_response_at: null })
      .eq("id", convId);
    return;
  }

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    console.error("[dispatch] LOVABLE_API_KEY missing");
    return;
  }

  const limit = Math.max(4, acc.ai_max_history ?? 20);
  const { data: msgs } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("direction,body,from_bot,type,timestamp")
    .eq("conversation_id", convId)
    .order("timestamp", { ascending: true })
    .limit(200);

  const recent = (msgs ?? []).slice(-limit);
  const history = recent
    .filter((m) => (m.body ?? "").trim().length > 0)
    .map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: m.body ?? "",
    }));

  if (history.length === 0) {
    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({ pending_response_at: null })
      .eq("id", convId);
    return;
  }

  const systemPrompt = [
    acc.ai_system_prompt,
    acc.ai_business_context
      ? `\n\nContexto del negocio (úsalo para responder):\n${acc.ai_business_context}`
      : "",
    `\n\nResponde SOLO con el mensaje que se debe enviar al cliente por WhatsApp. Sin prefijos como "Bot:" ni explicaciones meta. Sé conciso (idealmente 1-3 frases).`,
  ].join("");

  const ai = await callAI(apiKey, acc.ai_model, systemPrompt, history);
  if (!ai.ok || !ai.text) {
    console.error("[dispatch] AI failed", ai.status, ai.error);
    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({
        pending_response_at: new Date(Date.now() + 30_000).toISOString(),
      })
      .eq("id", convId);
    return;
  }

  const text = ai.text.slice(0, 3500);
  const sent = await sendWhatsApp(acc.phone_number_id, acc.access_token, conv.contact_wa_id, text);

  await supabaseAdmin.from("whatsapp_messages").insert({
    conversation_id: convId,
    client_id: acc.client_id,
    wa_message_id: sent.wa_id ?? null,
    direction: "outbound",
    from_bot: true,
    type: "text",
    body: text,
    timestamp: new Date().toISOString(),
    status: sent.ok ? "sent" : "failed",
  });

  await supabaseAdmin
    .from("whatsapp_conversations")
    .update({
      pending_response_at: null,
      last_bot_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 140),
    })
    .eq("id", convId);
}

export const Route = createFileRoute("/api/public/whatsapp/dispatch")({
  server: {
    handlers: {
      POST: async () => {
        const nowIso = new Date().toISOString();
        const { data: due } = await supabaseAdmin
          .from("whatsapp_conversations")
          .select("id")
          .not("pending_response_at", "is", null)
          .lte("pending_response_at", nowIso)
          .eq("ai_paused", false)
          .limit(25);

        const ids = (due ?? []).map((r) => r.id);
        for (const id of ids) {
          try {
            await processConversation(id);
          } catch (e: any) {
            console.error("[dispatch] error on", id, e?.message);
          }
        }
        return Response.json({ processed: ids.length });
      },
      GET: async () => {
        return Response.json({ ok: true, hint: "POST to trigger dispatch" });
      },
    },
  },
});
