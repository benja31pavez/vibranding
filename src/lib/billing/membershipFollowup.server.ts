/**
 * Correo de seguimiento de la membresía (servicio, no marketing): unos días
 * antes del fin del período pagado, si el cliente aún no renovó, le preguntamos
 * cómo le fue y le dejamos el link para renovar. Lo llama el cron por lotes
 * (/api/public/billing/membership-followup). Idempotente: payments.followup_sent_at.
 *
 * Sin RESEND_API_KEY no se envía nada (queda en el log). Nunca registra correos.
 */
import { addDays, todayInChile } from "./dates";
import { FOLLOWUP_DAYS_BEFORE_END, buildFollowupEmail, followupDue } from "./membership";
import { clientPayerEmail, loadMembership } from "./membership.server";
import { splitBatch, type BatchParams } from "@/lib/cron/batch";
import { findPlan } from "@/lib/pricing/plans";

export interface FollowupSummary {
  today: string;
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
  next_offset: number | null;
}

interface Candidate {
  id: string;
  client_id: string;
  plan_key: string | null;
  period_end: string | null;
  followup_sent_at: string | null;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Pagos de plan cuyo período termina dentro de la ventana (orden estable por id). */
async function loadCandidates(today: string, offset: number, limit: number) {
  const db = await admin();
  const { data, error } = await db
    .from("payments")
    .select("id,client_id,plan_key,period_end,followup_sent_at")
    .eq("status", "paid")
    .not("plan_key", "is", null)
    .gte("period_end", today)
    .lte("period_end", addDays(today, FOLLOWUP_DAYS_BEFORE_END))
    .order("id")
    .range(offset, offset + limit);
  if (error) throw new Error(`No se pudieron leer los períodos por terminar: ${error.message}`);
  return (data ?? []) as Candidate[];
}

async function clientName(clientId: string): Promise<string> {
  const db = await admin();
  const { data } = await db.from("clients").select("name").eq("id", clientId).maybeSingle();
  return data?.name?.trim() || "tu negocio";
}

async function contactName(clientId: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db
    .from("client_intake")
    .select("contacto_nombre")
    .eq("client_id", clientId)
    .maybeSingle();
  return data?.contacto_nombre?.trim() || null;
}

/** Marca el envío antes de mandar (otra corrida no lo repite). false si ya estaba. */
async function claim(paymentId: string, at: string | null): Promise<boolean> {
  const db = await admin();
  const base = db.from("payments").update({ followup_sent_at: at }).eq("id", paymentId);
  const { data, error } = await (at ? base.is("followup_sent_at", null) : base).select("id");
  if (error) throw new Error(`No se pudo marcar el seguimiento: ${error.message}`);
  return Boolean(data && data.length > 0);
}

type Outcome = "sent" | "skipped" | "failed";

async function processCandidate(c: Candidate, today: string, apiKey: string): Promise<Outcome> {
  const plan = findPlan(c.plan_key);
  if (!plan || !c.period_end) return "skipped";
  const membership = await loadMembership(c.client_id, today);
  // Solo el último período cubierto (si ya renovó, coveredUntil es posterior).
  if (membership.coveredUntil !== c.period_end) return "skipped";
  if (!followupDue(membership, Boolean(c.followup_sent_at))) return "skipped";

  const to = await clientPayerEmail(c.client_id);
  if (!to) {
    console.warn("[membresía seguimiento] cliente sin correo de contacto", c.client_id);
    return "skipped";
  }
  if (!(await claim(c.id, new Date().toISOString()))) return "skipped";

  const { publicOrigin } = await import("@/lib/meta/oauth.server");
  const { DEFAULT_FROM, sendViaResend, toHtml } = await import("@/lib/bookings/notify.server");
  const email = buildFollowupEmail({
    clientName: await clientName(c.client_id),
    contactName: await contactName(c.client_id),
    planLabel: plan.label,
    periodEnd: c.period_end,
    renewUrl: `${publicOrigin()}/clients/${c.client_id}/facturacion`,
    oneTime: plan.billing === "one_time",
  });
  try {
    await sendViaResend(apiKey, process.env["RESEND_FROM"]?.trim() || DEFAULT_FROM, {
      kind: "cliente",
      to,
      subject: email.subject,
      text: email.lines.join("\n"),
      html: toHtml(email.lines),
      replyTo: process.env["BILLING_REPLY_TO"]?.trim() || undefined,
    });
    return "sent";
  } catch (e) {
    console.error("[membresía seguimiento] no se pudo enviar", c.id, (e as Error).message);
    await claim(c.id, null).catch(() => undefined); // se reintenta mañana
    return "failed";
  }
}

export async function runMembershipFollowupBatch(
  params: BatchParams,
  today: string = todayInChile(),
): Promise<FollowupSummary> {
  const rows = await loadCandidates(today, params.offset, params.limit);
  const { batch, nextOffset } = splitBatch(rows, params.offset, params.limit);
  const summary: FollowupSummary = {
    today,
    checked: batch.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    next_offset: nextOffset,
  };
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  if (!apiKey) {
    if (batch.length > 0) {
      console.error("[membresía seguimiento] RESEND_API_KEY no configurada: no se envían correos");
    }
    return { ...summary, skipped: batch.length };
  }
  const outcomes: Outcome[] = [];
  for (const c of batch) {
    try {
      outcomes.push(await processCandidate(c, today, apiKey));
    } catch (e) {
      console.error("[membresía seguimiento] falló", c.id, (e as Error).message);
      outcomes.push("failed");
    }
  }
  return {
    ...summary,
    sent: outcomes.filter((o) => o === "sent").length,
    skipped: outcomes.filter((o) => o === "skipped").length,
    failed: outcomes.filter((o) => o === "failed").length,
  };
}
