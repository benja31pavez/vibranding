// Multi-step flow engine for the WhatsApp bot.
// Executed from the webhook (inbound message) and from the dispatch worker (delayed steps).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendBotActions, type BotAction } from "@/lib/whatsapp/sendActions";
import {
  END_STEP,
  interpolate,
  type FlowStep,
} from "@/lib/whatsapp/flowTypes";

const MAX_STEPS_PER_RUN = 25;
const MAX_RETRIES = 2;
const CANCEL_WORDS = ["cancelar", "salir", "stop", "detener", "basta"];

export type FlowRun = {
  id: string;
  client_id: string;
  conversation_id: string;
  rule_id: string | null;
  status: string;
  current_step_id: string | null;
  awaiting_input: boolean;
  retry_count: number;
  variables: Record<string, any>;
  next_run_at: string | null;
};

type SendCtx = {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  clientId: string;
  conversationId: string;
  contactName: string | null;
  contactWaId: string;
};

const flowRuns = () => supabaseAdmin.from("whatsapp_flow_runs" as any) as any;

export function hasFlow(rule: { flow_steps?: unknown }): boolean {
  return Array.isArray(rule.flow_steps) && (rule.flow_steps as unknown[]).length > 0;
}

function normalize(s: string): string {
  return (s ?? "").toLowerCase().trim();
}

function stepsOf(rule: { flow_steps?: unknown }): FlowStep[] {
  return Array.isArray(rule.flow_steps) ? (rule.flow_steps as FlowStep[]) : [];
}

function nextCursor(steps: FlowStep[], step: FlowStep): string | null {
  if (step.next_step_id === END_STEP) return null;
  if (step.next_step_id) return step.next_step_id;
  const idx = steps.findIndex((s) => s.id === step.id);
  const next = steps[idx + 1];
  return next ? next.id : null;
}

function resolveTarget(steps: FlowStep[], target: string | null | undefined, fallbackFrom: FlowStep) {
  if (target === END_STEP) return null;
  if (target) return steps.some((s) => s.id === target) ? target : nextCursor(steps, fallbackFrom);
  return nextCursor(steps, fallbackFrom);
}

/** Persist an outbound bot message and refresh the conversation preview. */
async function logOutbound(
  ctx: SendCtx,
  results: Array<{ ok: boolean; wa_id?: string; preview: string; type: string }>,
) {
  let lastPreview = "";
  for (const r of results) {
    lastPreview = r.preview;
    await supabaseAdmin.from("whatsapp_messages").insert({
      conversation_id: ctx.conversationId,
      client_id: ctx.clientId,
      wa_message_id: r.wa_id ?? null,
      direction: "outbound",
      from_bot: true,
      type: r.type,
      body: r.preview,
      timestamp: new Date().toISOString(),
      status: r.ok ? "sent" : "failed",
    });
  }
  if (lastPreview) {
    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: lastPreview.slice(0, 140),
        last_bot_at: new Date().toISOString(),
        pending_response_at: null,
      })
      .eq("id", ctx.conversationId);
  }
}

async function send(ctx: SendCtx, actions: BotAction[]) {
  if (actions.length === 0) return;
  const results = await sendBotActions(ctx.phoneNumberId, ctx.accessToken, ctx.to, actions);
  await logOutbound(ctx, results);
}

function questionAction(step: FlowStep, vars: Record<string, any>, hint?: string): BotAction {
  const prompt = [interpolate(step.prompt ?? "", vars), hint].filter(Boolean).join("\n\n");
  const labels = (step.choices ?? [])
    .map((c) => interpolate(c.label ?? "", vars).trim())
    .filter(Boolean);
  if (step.reply_mode !== "text" && labels.length > 0) {
    // 1-3 options render as buttons, 4+ as a list — sendActions already handles that split.
    return { kind: "poll", question: prompt, options: labels };
  }
  return { kind: "text", body: prompt };
}

async function addTags(conversationId: string, tags: string[]) {
  const clean = tags.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return;
  const { data } = await supabaseAdmin
    .from("whatsapp_conversations")
    .select("tags")
    .eq("id", conversationId)
    .maybeSingle();
  const current: string[] = ((data as any)?.tags ?? []) as string[];
  const merged = Array.from(new Set([...current, ...clean]));
  await supabaseAdmin
    .from("whatsapp_conversations")
    .update({ tags: merged } as any)
    .eq("id", conversationId);
}

async function saveLead(ctx: SendCtx, vars: Record<string, any>) {
  const name = String(vars.name ?? ctx.contactName ?? ctx.contactWaId).slice(0, 160);
  const email = vars.email ? String(vars.email).slice(0, 200) : null;
  const summary = Object.entries(vars)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const { data: existing } = await (supabaseAdmin.from("client_leads" as any) as any)
    .select("id")
    .eq("conversation_id", ctx.conversationId)
    .maybeSingle();

  const payload = {
    client_id: ctx.clientId,
    source: "whatsapp",
    name,
    contact: vars.phone ? String(vars.phone) : ctx.contactWaId,
    email,
    message: summary || null,
    metadata: vars,
    conversation_id: ctx.conversationId,
  };

  if (existing?.id) {
    await (supabaseAdmin.from("client_leads" as any) as any)
      .update(payload)
      .eq("id", existing.id);
  } else {
    await (supabaseAdmin.from("client_leads" as any) as any).insert(payload);
  }

  await supabaseAdmin
    .from("whatsapp_conversations")
    .update({ is_lead: true })
    .eq("id", ctx.conversationId);
}

async function finish(runId: string, status: "completed" | "cancelled") {
  await flowRuns()
    .update({
      status,
      awaiting_input: false,
      next_run_at: null,
      current_step_id: null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

/**
 * Executes steps starting at `cursor` until the flow needs to wait
 * (a question, a delay) or ends.
 */
async function execute(
  run: FlowRun,
  steps: FlowStep[],
  ctx: SendCtx,
  cursor: string | null,
  vars: Record<string, any>,
) {
  let current = cursor;
  for (let guard = 0; guard < MAX_STEPS_PER_RUN; guard++) {
    if (!current) return finish(run.id, "completed");
    const step = steps.find((s) => s.id === current);
    if (!step) return finish(run.id, "completed");

    switch (step.kind) {
      case "message": {
        const actions = (Array.isArray(step.actions) ? step.actions : []).map((a: any) =>
          a?.kind === "text"
            ? { ...a, body: interpolate(a.body ?? "", vars) }
            : a?.kind === "link" || a?.kind === "image" || a?.kind === "document"
              ? { ...a, caption: interpolate(a.caption ?? "", vars) }
              : a,
        ) as BotAction[];
        await send(ctx, actions);
        current = nextCursor(steps, step);
        break;
      }
      case "tag": {
        await addTags(ctx.conversationId, step.tags ?? []);
        current = nextCursor(steps, step);
        break;
      }
      case "save_lead": {
        await saveLead(ctx, vars);
        current = nextCursor(steps, step);
        break;
      }
      case "handoff": {
        await supabaseAdmin
          .from("whatsapp_conversations")
          .update({
            needs_human_followup: true,
            human_followup_reason: step.reason ?? "Flujo derivado al equipo",
            human_followup_at: new Date().toISOString(),
            ai_paused: true,
          } as any)
          .eq("id", ctx.conversationId);
        current = nextCursor(steps, step);
        break;
      }
      case "delay": {
        const seconds = Math.max(5, Number(step.delay_seconds) || 60);
        await flowRuns()
          .update({
            variables: vars,
            awaiting_input: false,
            current_step_id: nextCursor(steps, step),
            next_run_at: new Date(Date.now() + seconds * 1000).toISOString(),
          })
          .eq("id", run.id);
        return;
      }
      case "question": {
        await send(ctx, [questionAction(step, vars)]);
        await flowRuns()
          .update({
            variables: vars,
            awaiting_input: true,
            retry_count: 0,
            current_step_id: step.id,
            next_run_at: null,
          })
          .eq("id", run.id);
        return;
      }
      default:
        current = nextCursor(steps, step);
    }
  }
  // Safety valve: a badly wired flow must not loop forever.
  await flowRuns()
    .update({ last_error: "Se alcanzó el máximo de pasos por ejecución" })
    .eq("id", run.id);
  await finish(run.id, "completed");
}

/** Starts a flow for a conversation, replacing any run already in progress. */
export async function startFlow(
  rule: { id: string; flow_steps?: unknown; mark_as_lead?: boolean },
  ctx: SendCtx,
): Promise<boolean> {
  const steps = stepsOf(rule);
  if (steps.length === 0) return false;

  await flowRuns()
    .update({ status: "cancelled", finished_at: new Date().toISOString(), awaiting_input: false })
    .eq("conversation_id", ctx.conversationId)
    .eq("status", "running");

  const vars: Record<string, any> = {
    name: ctx.contactName ?? undefined,
    phone: ctx.contactWaId,
  };

  const { data: run, error } = await flowRuns()
    .insert({
      client_id: ctx.clientId,
      conversation_id: ctx.conversationId,
      rule_id: rule.id,
      status: "running",
      current_step_id: steps[0].id,
      variables: vars,
    })
    .select("*")
    .single();
  if (error || !run) {
    console.error("[flow] could not start run", error?.message);
    return false;
  }
  await execute(run as FlowRun, steps, ctx, steps[0].id, vars);
  return true;
}

function validateAnswer(step: FlowStep, text: string): { ok: boolean; value: any; hint?: string } {
  const raw = (text ?? "").trim();
  if (!raw) return { ok: false, value: null, hint: "No recibí tu respuesta, ¿me la repites?" };
  if (step.input_type === "email") {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw);
    return ok
      ? { ok: true, value: raw }
      : { ok: false, value: raw, hint: "Necesito un correo válido, por ejemplo nombre@dominio.com" };
  }
  if (step.input_type === "number") {
    const digits = raw.replace(/[^\d]/g, "");
    return digits
      ? { ok: true, value: Number(digits) }
      : { ok: false, value: raw, hint: "Respóndeme solo con un número." };
  }
  return { ok: true, value: raw };
}

function matchChoice(step: FlowStep, text: string, interactiveId: string | null) {
  const choices = step.choices ?? [];
  if (choices.length === 0) return null;
  if (interactiveId) {
    const m = /^opt_(\d+)$/.exec(interactiveId);
    if (m) {
      const idx = Number(m[1]);
      // sendActions only ships non-empty labels, so index against that same list.
      const shipped = choices.filter((c) => (c.label ?? "").trim());
      if (shipped[idx]) return shipped[idx];
    }
  }
  const t = normalize(text);
  return (
    choices.find((c) => normalize(c.label) === t) ??
    choices.find((c) => t && normalize(c.label).includes(t)) ??
    null
  );
}

function matchCondition(step: FlowStep, text: string) {
  const t = normalize(text);
  for (const c of step.conditions ?? []) {
    const v = normalize(c.value);
    if (c.match === "any") return c;
    if (c.match === "equals" && t === v) return c;
    if (c.match === "starts_with" && v && t.startsWith(v)) return c;
    if (c.match === "contains" && v && t.includes(v)) return c;
  }
  return null;
}

/**
 * Routes an inbound message into the active flow.
 * Returns true when the flow consumed the message (so rules/AI must not answer).
 */
export async function handleFlowReply(
  run: FlowRun,
  ctx: SendCtx,
  text: string,
  interactiveId: string | null,
): Promise<boolean> {
  if (CANCEL_WORDS.includes(normalize(text))) {
    await finish(run.id, "cancelled");
    await send(ctx, [{ kind: "text", body: "Listo, cancelé el proceso. Escríbeme cuando quieras 🙌" }]);
    return true;
  }

  const { data: rule } = await supabaseAdmin
    .from("whatsapp_bot_rules")
    .select("*")
    .eq("id", run.rule_id ?? "")
    .maybeSingle();
  const steps = stepsOf((rule ?? {}) as any);
  const step = steps.find((s) => s.id === run.current_step_id);

  if (!rule || !step || step.kind !== "question") {
    // Flow is stale (rule edited or deleted): close it and let the rules/AI take over.
    await finish(run.id, "completed");
    return false;
  }

  const vars = { ...(run.variables ?? {}) };
  const usesChoices = step.reply_mode !== "text" && (step.choices ?? []).length > 0;
  const choice = usesChoices ? matchChoice(step, text, interactiveId) : null;

  if (usesChoices && !choice) {
    if ((run.retry_count ?? 0) < MAX_RETRIES) {
      await flowRuns()
        .update({ retry_count: (run.retry_count ?? 0) + 1 })
        .eq("id", run.id);
      await send(ctx, [
        questionAction(step, vars, "Elige una de las opciones para continuar 👇"),
      ]);
      return true;
    }
    // Too many misses: keep the raw answer and move on instead of trapping the contact.
    if (step.variable) vars[step.variable] = (text ?? "").trim();
    await flowRuns().update({ variables: vars, awaiting_input: false }).eq("id", run.id);
    await execute(run, steps, ctx, nextCursor(steps, step), vars);
    return true;
  }

  let value: any = choice ? choice.label : null;
  if (!choice) {
    const res = validateAnswer(step, text);
    if (!res.ok && (run.retry_count ?? 0) < MAX_RETRIES) {
      await flowRuns()
        .update({ retry_count: (run.retry_count ?? 0) + 1 })
        .eq("id", run.id);
      await send(ctx, [questionAction(step, vars, res.hint)]);
      return true;
    }
    value = res.value;
  }

  if (step.variable) vars[step.variable] = value;

  const branch = choice
    ? resolveTarget(steps, choice.next_step_id, step)
    : (() => {
        const cond = matchCondition(step, text);
        return cond ? resolveTarget(steps, cond.next_step_id, step) : nextCursor(steps, step);
      })();

  await flowRuns()
    .update({ variables: vars, awaiting_input: false, retry_count: 0 })
    .eq("id", run.id);
  await execute({ ...run, variables: vars }, steps, ctx, branch, vars);
  return true;
}

/** Resumes a run whose delayed step is due. Used by the dispatch worker. */
export async function resumeFlowRun(run: FlowRun, ctx: SendCtx) {
  const { data: rule } = await supabaseAdmin
    .from("whatsapp_bot_rules")
    .select("*")
    .eq("id", run.rule_id ?? "")
    .maybeSingle();
  const steps = stepsOf((rule ?? {}) as any);
  if (!rule || steps.length === 0) return finish(run.id, "completed");
  await flowRuns().update({ next_run_at: null }).eq("id", run.id);
  await execute(run, steps, ctx, run.current_step_id, { ...(run.variables ?? {}) });
}

/** The active run for a conversation, if any. */
export async function getActiveRun(conversationId: string): Promise<FlowRun | null> {
  const { data } = await flowRuns()
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("status", "running")
    .maybeSingle();
  return (data ?? null) as FlowRun | null;
}
