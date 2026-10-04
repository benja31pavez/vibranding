import { graphBase } from "@/lib/meta/version";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";

import { zonedParts } from "@/lib/bookings/tz";
import { getWaSecret } from "@/lib/whatsapp/tokens.server";
import { getActiveRun, resumeFlowRun, type FlowRun } from "@/lib/whatsapp/flow.server";

const META = graphBase();
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type WAAccount = {
  id: string;
  client_id: string;
  phone_number_id: string | null;
  ai_enabled: boolean;
  ai_system_prompt: string;
  ai_model: string;
  ai_max_history: number;
  ai_business_context: string | null;
  website_url: string | null;
  social_links: { label: string; url: string }[] | null;
  catalog: { name: string; price?: string; url?: string; image_url?: string }[] | null;
  business_name: string | null;
  business_hours:
    | { day: number; enabled: boolean; open: string; close: string }[]
    | null;
  timezone: string | null;
};

const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function describeHours(
  hours: WAAccount["business_hours"],
  timezone: string,
): { summary: string; nowOpen: boolean | null } {
  if (!Array.isArray(hours) || hours.length === 0) return { summary: "", nowOpen: null };
  const lines = hours.map((h) => {
    const name = DAY_NAMES[h.day] ?? `día ${h.day}`;
    return h.enabled ? `${name}: ${h.open}–${h.close}` : `${name}: cerrado`;
  });
  // Resolve "now" in the business timezone (dayIdx: 0=Mon..6=Sun, same as business_hours)
  const tz = timezone || "America/Santiago";
  let nowOpen: boolean | null = null;
  try {
    const { dayIdx, minutes } = zonedParts(new Date().toISOString(), tz);
    const today = hours.find((h) => h.day === dayIdx);
    if (today) {
      if (!today.enabled) nowOpen = false;
      else {
        const [oh, om] = today.open.split(":").map(Number);
        const [ch, cm] = today.close.split(":").map(Number);
        nowOpen = minutes >= oh * 60 + om && minutes <= ch * 60 + cm;
      }
    }
  } catch {
    nowOpen = null;
  }
  return { summary: lines.join("\n"), nowOpen };
}

// Phrases that signal the AI is handing off to a human.
const HANDOFF_PATTERNS: RegExp[] = [
  /se (pondr[áa]|comunicar[áa]|contactar[áa])/i,
  /(te|le) (contactar[áa]|escribir[áa]|llamar[áa]|responder[áa])/i,
  /(nuestro|nuestra|el|la) (equipo|asesor|representante|encargado|encargada|due[ñn]o|due[ñn]a)/i,
  /(un|una) (asesor|asesora|representante|persona|agente) .*(contact|escrib|responder|llamar)/i,
  /derivar(é|e) (tu|este) (caso|consulta|mensaje)/i,
  /pasar(é|e) (tu|este) (caso|consulta|mensaje)/i,
];

function detectHandoff(text: string): string | null {
  for (const re of HANDOFF_PATTERNS) {
    if (re.test(text)) return text.match(re)?.[0] ?? "Handoff detectado";
  }
  return null;
}

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

  // Atomically claim the conversation: only one runner may proceed.
  const { data: claimed } = await supabaseAdmin
    .from("whatsapp_conversations")
    .update({ pending_response_at: null })
    .eq("id", convId)
    .eq("pending_response_at", conv.pending_response_at)
    .select("id");
  if (!claimed || claimed.length === 0) {
    // Another dispatch run already took this conversation.
    return;
  }

  // Instagram DM conversations have no WhatsApp account and no AI auto-reply.
  if (!conv.account_id) return;

  const { data: acc } = await supabaseAdmin
    .from("whatsapp_accounts")
    .select(
      "id,client_id,phone_number_id,ai_enabled,ai_system_prompt,ai_model,ai_max_history,ai_business_context,website_url,social_links,catalog,business_name,business_hours,timezone",
    )
    .eq("id", conv.account_id)
    .maybeSingle<WAAccount>();
  const accessToken = acc?.phone_number_id ? await getWaSecret(acc.id, "access_token") : null;
  if (!acc || !acc.ai_enabled || !acc.phone_number_id || !accessToken) {
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

  const socials = (acc.social_links ?? []).filter((s) => s?.url?.trim());
  const catalog = (acc.catalog ?? []).filter((c) => c?.name?.trim());
  const { summary: hoursSummary, nowOpen } = describeHours(acc.business_hours, acc.timezone ?? "America/Santiago");
  const profileBlock = [
    acc.business_name ? `Nombre del negocio: ${acc.business_name}` : "",
    acc.website_url ? `Sitio web: ${acc.website_url}` : "",
    socials.length
      ? `Redes:\n${socials.map((s) => `- ${s.label || s.url}: ${s.url}`).join("\n")}`
      : "",
    catalog.length
      ? `Catálogo:\n${catalog
          .map(
            (c) =>
              `- ${c.name}${c.price ? ` (${c.price})` : ""}${c.url ? ` → ${c.url}` : ""}`,
          )
          .join("\n")}`
      : "",
    hoursSummary
      ? `Horarios de atención:\n${hoursSummary}\nEstado ahora mismo: ${
          nowOpen === null ? "desconocido" : nowOpen ? "ABIERTO" : "CERRADO"
        }`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // Booking context — let the AI know how the agenda works and what's already taken.

  // Look up the client's owner via the clients table to find the right agenda
  const { data: cli } = await supabaseAdmin
    .from("clients")
    .select("user_id")
    .eq("id", acc.client_id)
    .maybeSingle();

  let bookingBlock = "";
  if (cli?.user_id) {
    const { data: settings } = await supabaseAdmin
      .from("booking_settings")
      .select("id,slug,display_name,hours,slot_minutes,timezone,enabled")
      .eq("owner_user_id", cli.user_id)
      // Only this client's agenda — never the agency's own or another client's.
      .eq("client_id", acc.client_id)
      .eq("enabled", true);

    if (settings && settings.length > 0) {
      const siteOrigin = process.env["PUBLIC_SITE_URL"]?.trim().replace(/\/+$/, "") || null;
      if (!siteOrigin) {
        console.warn("[wa dispatch] PUBLIC_SITE_URL no configurada: se omite el link de reservas.");
      }
      const now = new Date();
      const in14d = new Date(now.getTime() + 14 * 86_400_000);
      const ids = settings.map((s) => s.id);
      const { data: upcoming } = await supabaseAdmin
        .from("bookings")
        .select("scheduled_at,settings_id")
        .in("settings_id", ids)
        .eq("status", "confirmed")
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", in14d.toISOString());

      const lines = settings.map((s) => {
        const hrs = (s.hours as any as { day: number; enabled: boolean; open: string; close: string }[])
          .map((h) => (h.enabled ? `${DAY_NAMES[h.day]} ${h.open}-${h.close}` : null))
          .filter(Boolean)
          .join(", ");
        const taken = (upcoming ?? [])
          .filter((u) => u.settings_id === s.id)
          .map((u) => new Date(u.scheduled_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: s.timezone }))
          .join("; ");
        const linkLine = siteOrigin ? `\n  Link: ${siteOrigin}/book/${s.slug}` : "";
        return `- ${s.display_name}${linkLine}\n  Citas de ${s.slot_minutes} min · ${hrs}\n  Reglas: solo se puede agendar desde MAÑANA (zona horaria ${s.timezone}) hasta 30 días en adelante. NO se permite agendar el mismo día.\n  Slots ya ocupados (próximos 14 días): ${taken || "ninguno"}`;
      });
      bookingBlock = lines.join("\n\n");
    }
  }

  // Knowledge base — answered Q&A from the owner enriches the bot's understanding.
  const { data: knowledge } = await (supabaseAdmin.from("bot_knowledge" as any) as any)
    .select("question,answer")
    .eq("account_id", acc.id)
    .eq("status", "answered")
    .order("sort_order", { ascending: true })
    .limit(60);

  const knowledgeBlock = ((knowledge ?? []) as Array<{ question: string; answer: string }>)
    .filter((k) => k.answer && k.answer.trim())
    .map((k) => `P: ${k.question}\nR: ${k.answer.trim()}`)
    .join("\n\n");

  const systemPrompt = [
    acc.ai_system_prompt,
    acc.ai_business_context
      ? `\n\nContexto del negocio (úsalo para responder):\n${acc.ai_business_context}`
      : "",
    profileBlock ? `\n\nPerfil del negocio:\n${profileBlock}` : "",
    knowledgeBlock
      ? `\n\nConocimiento del dueño (respuestas oficiales, prioriza esto sobre suposiciones):\n${knowledgeBlock}`
      : "",
    bookingBlock
      ? `\n\nAgenda y reservas:\n${bookingBlock}\n\nSi alguien quiere agendar una reunión, comparte el link de reservas correspondiente y explícale que solo se puede reservar a partir de MAÑANA (no hoy) y hasta 30 días en adelante.`
      : "",
    nowOpen === false
      ? `\n\nIMPORTANTE: El negocio está cerrado en este momento. Indícalo amablemente y menciona cuándo se atenderá su consulta.`
      : "",
    `\n\nResponde SOLO con el mensaje que se debe enviar al cliente por WhatsApp. Sin prefijos como "Bot:" ni explicaciones meta. Sé conciso (idealmente 1-3 frases). Si necesitas derivar a una persona real, dilo con claridad ("alguien del equipo te contactará pronto") — esto activa un recordatorio interno.`,
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
  const sent = await sendWhatsApp(acc.phone_number_id, accessToken, conv.contact_wa_id, text);

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

  // Detect AI handoff to a human → flag conversation as needing follow-up
  // and pause the bot so the human takes over.
  const handoff = detectHandoff(text);
  const updatePatch: Record<string, unknown> = {
    pending_response_at: null,
    last_bot_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
    last_message_preview: text.slice(0, 140),
  };
  if (handoff && !conv.needs_human_followup) {
    updatePatch.needs_human_followup = true;
    updatePatch.human_followup_reason = `IA derivó al equipo: "${handoff.slice(0, 120)}"`;
    updatePatch.human_followup_at = new Date().toISOString();
    updatePatch.is_lead = true;
    updatePatch.ai_paused = true;
  }

  await supabaseAdmin
    .from("whatsapp_conversations")
    .update(updatePatch as any)
    .eq("id", convId);

  // Dynamic learning: when we had to hand off, ask the AI to identify ONE
  // missing piece of info the owner should provide so the bot can answer
  // similar messages autonomously next time. Insert as a pending question.
  if (handoff) {
    try {
      const recentUser = history.filter((h) => h.role === "user").slice(-3).map((h) => h.content).join("\n");
      const gapPrompt = `Eres un coach que ayuda a un dueño de negocio a entrenar a su bot de WhatsApp. El bot acaba de derivar esta consulta a un humano porque no supo responder. Tu tarea: redactar UNA sola pregunta breve y específica (máx. 140 caracteres) que el dueño debería responder para que el bot pueda manejar consultas similares por sí solo. NO repitas información ya conocida. Responde SOLO con la pregunta, sin comillas ni prefijos.\n\nMensajes del cliente:\n${recentUser}\n\nLo que el bot respondió (derivó):\n${text}`;
      const gap = await callAI(apiKey, acc.ai_model, gapPrompt, [{ role: "user", content: "Genera la pregunta." }]);
      const question = gap.text?.trim().replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 280);
      if (question && question.length > 8) {
        const { data: existing } = await (supabaseAdmin.from("bot_knowledge" as any) as any)
          .select("question").eq("account_id", acc.id);
        const norm = (s: string) => s.toLowerCase().replace(/[¿?¡!.,;:]/g, "").trim();
        const exists = ((existing ?? []) as Array<{ question: string }>).some(
          (e) => norm(e.question) === norm(question),
        );
        if (!exists) {
          await (supabaseAdmin.from("bot_knowledge" as any) as any).insert({
            account_id: acc.id,
            client_id: acc.client_id,
            question,
            origin: "auto",
            context_snippet: recentUser.slice(0, 200),
          });
        }
      }
    } catch (e: any) {
      console.error("[dispatch] knowledge-gap generation failed", e?.message);
    }
  }
}

export const Route = createFileRoute("/api/public/whatsapp/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // This endpoint consumes AI credits — it must never be callable anonymously.
        const dispatchSecret = process.env.DISPATCH_SECRET;
        if (!dispatchSecret) {
          console.error(
            "[dispatch] DISPATCH_SECRET missing — rejecting request instead of processing untrusted call",
          );
          return new Response("Server misconfigured", { status: 500 });
        }
        const provided = request.headers.get("x-dispatch-secret") ?? "";
        const [a, b] = await Promise.all([
          hmacSha256Hex(dispatchSecret, provided),
          hmacSha256Hex(dispatchSecret, dispatchSecret),
        ]);
        if (!timingSafeEqualHex(a, b)) {
          return new Response("Forbidden", { status: 403 });
        }

        const nowIso = new Date().toISOString();

        // 1) Resume flows whose "espera" step is due.
        const { data: dueRuns } = await (supabaseAdmin.from("whatsapp_flow_runs" as any) as any)
          .select("*")
          .eq("status", "running")
          .not("next_run_at", "is", null)
          .lte("next_run_at", nowIso)
          .limit(25);

        let flowsResumed = 0;
        for (const run of (dueRuns ?? []) as FlowRun[]) {
          try {
            const { data: conv } = await supabaseAdmin
              .from("whatsapp_conversations")
              .select("id,account_id,contact_wa_id,contact_name,ai_paused")
              .eq("id", run.conversation_id)
              .maybeSingle();
            if (!conv || conv.ai_paused || !conv.account_id) continue;
            const { data: acc } = await supabaseAdmin
              .from("whatsapp_accounts")
              .select("id,phone_number_id,client_id")
              .eq("id", conv.account_id)
              .maybeSingle();
            if (!acc?.phone_number_id) continue;
            const token = await getWaSecret(acc.id, "access_token");
            if (!token) continue;
            await resumeFlowRun(run, {
              phoneNumberId: acc.phone_number_id,
              accessToken: token,
              to: conv.contact_wa_id,
              clientId: acc.client_id,
              conversationId: conv.id,
              contactName: conv.contact_name ?? null,
              contactWaId: conv.contact_wa_id,
            });
            flowsResumed++;
          } catch (e: any) {
            console.error("[dispatch] flow resume failed", run.id, e?.message);
          }
        }

        const { data: due } = await supabaseAdmin
          .from("whatsapp_conversations")
          .select("id")
          .not("pending_response_at", "is", null)
          .lte("pending_response_at", nowIso)
          .eq("ai_paused", false)
          .limit(25);

        const ids = (due ?? []).map((r) => r.id);
        let aiProcessed = 0;
        for (const id of ids) {
          try {
            // A live flow owns the conversation: the AI must not talk over it.
            const active = await getActiveRun(id);
            if (active) {
              await supabaseAdmin
                .from("whatsapp_conversations")
                .update({ pending_response_at: null })
                .eq("id", id);
              continue;
            }
            aiProcessed++;
            await processConversation(id);
          } catch (e: any) {
            console.error("[dispatch] error on", id, e?.message);
          }
        }
        return Response.json({ processed: aiProcessed, flows_resumed: flowsResumed });
      },
      GET: async () => {
        return Response.json({ ok: true, hint: "POST to trigger dispatch" });
      },
    },
  },
});
