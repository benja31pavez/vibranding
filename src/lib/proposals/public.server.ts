/**
 * Lógica de servidor de la propuesta pública /p/$token.
 * Solo servidor: usa el service role. Quien llame ya validó el input (zod) y el
 * límite por IP; el token se valida además en cada función SQL.
 */
import type { Database } from "@/integrations/supabase/types";
import { firstDayOfMonth, todayInChile } from "@/lib/billing/dates";
import {
  chargeKind,
  computeTotals,
  parseItems,
  proposalConditions,
  type ProposalItem,
} from "./model";
import { decideMarkViewed, type ViewSignal } from "./viewTracking";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

export interface PublicProposal {
  title: string | null;
  status: string;
  planKey: string | null;
  items: ProposalItem[];
  amountClp: number;
  expiresAt: string | null;
  acceptedAt: string | null;
  acceptedName: string | null;
  recipientName: string | null;
  agencyName: string | null;
}

/**
 * Qué puede hacer el cliente con el pago después de aceptar:
 *  - none: la propuesta no tiene monto a cobrar.
 *  - contact: es de un prospecto sin cliente; la agencia lo contacta.
 *  - paid: el primer pago ya está pagado.
 *  - flow: hay cobro pendiente y Flow está configurado ("Pagar ahora").
 *  - transfer: hay cobro pendiente pero no hay Flow: le enviamos los datos.
 */
export type PublicPaymentState =
  | { state: "none" }
  | { state: "contact" }
  | { state: "paid" }
  | { state: "flow"; paymentUrl: string | null }
  | { state: "transfer" };

export type PublicProposalResult =
  | { ok: false }
  | { ok: true; proposal: PublicProposal; payment: PublicPaymentState | null };

interface ProposalRow {
  id: string;
  org_id: string;
  client_id: string | null;
  prospect_id: string | null;
  title: string | null;
  plan_key: string | null;
  items: unknown;
  amount_clp: number;
  status: string;
  accepted_text: string | null;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Las funciones nuevas aún no están todas en types.ts: rpc sin tipar. */
async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const db = await admin();
  const { data, error } = await (db as unknown as {
    rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc(fn, args);
  if (error) {
    console.error(`[proposals] ${fn} falló`, error.message);
    throw new Error("No pudimos cargar la propuesta. Intenta de nuevo en unos minutos.");
  }
  return data;
}

function toPublic(raw: Record<string, unknown>): PublicProposal {
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    title: str(raw.title),
    status: str(raw.status) ?? "invalid",
    planKey: str(raw.plan_key),
    items: parseItems(raw.items),
    amountClp: Number(raw.amount_clp) || 0,
    expiresAt: str(raw.expires_at),
    acceptedAt: str(raw.accepted_at),
    acceptedName: str(raw.accepted_name),
    recipientName: str(raw.recipient_name),
    agencyName: str(raw.agency_name),
  };
}

async function loadRow(token: string): Promise<ProposalRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("proposals")
    .select("id,org_id,client_id,prospect_id,title,plan_key,items,amount_clp,status,accepted_text")
    .eq("token", token)
    .neq("status", "borrador")
    .maybeSingle();
  if (error) {
    console.error("[proposals] no se pudo leer la propuesta", error.message);
    throw new Error("No pudimos procesar la propuesta. Intenta de nuevo.");
  }
  return data;
}

// ------------------------------------------------------------------ cobro

/** Marca que liga un cobro con su propuesta (payments no tiene proposal_id). */
export function paymentRef(proposalId: string): string {
  return `ref P-${proposalId.slice(0, 8)}`;
}

async function findProposalPayment(row: ProposalRow): Promise<PaymentRow | null> {
  if (!row.client_id) return null;
  const db = await admin();
  const { data, error } = await db
    .from("payments")
    .select("*")
    .eq("client_id", row.client_id)
    .ilike("description", `%${paymentRef(row.id)}%`)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) {
    console.error("[proposals] no se pudo buscar el cobro", row.id, error.message);
    throw new Error("No pudimos revisar el estado del pago.");
  }
  return data?.[0] ?? null;
}

async function createProposalPayment(row: ProposalRow & { client_id: string }): Promise<PaymentRow> {
  const totals = computeTotals(parseItems(row.items));
  const kind = chargeKind(totals);
  const today = todayInChile();
  const what = kind === "mensual" ? "primer mes" : "pago único";
  const db = await admin();
  const { data, error } = await db
    .from("payments")
    .insert({
      client_id: row.client_id,
      amount: row.amount_clp,
      currency: "CLP",
      status: "pending",
      kind,
      period: kind === "mensual" ? firstDayOfMonth(today) : null,
      due_date: today,
      description: `Propuesta "${(row.title ?? "Vibranding").slice(0, 80)}" (${what}) · ${paymentRef(row.id)}`,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[proposals] no se pudo crear el cobro", row.id, error?.message);
    throw new Error("Tu aceptación quedó registrada, pero no pudimos generar el cobro. Te contactaremos.");
  }
  return data;
}

/** Deja una nota en el prospecto para que la agencia cree el cliente y el cobro. */
async function noteOnProspect(row: ProposalRow, acceptedName: string): Promise<void> {
  if (!row.prospect_id) return;
  const db = await admin();
  const { data, error } = await db.from("prospects").select("notas").eq("id", row.prospect_id).maybeSingle();
  if (error) {
    console.error("[proposals] no se pudo leer el prospecto", row.prospect_id, error.message);
    return;
  }
  const note = `[${todayInChile()}] Aceptó la propuesta "${row.title ?? ""}" (${acceptedName}). Falta crear el cliente y el cobro.`;
  const notas = data?.notas ? `${data.notas}\n${note}` : note;
  const { error: upErr } = await db.from("prospects").update({ notas }).eq("id", row.prospect_id);
  if (upErr) console.error("[proposals] no se pudo anotar el prospecto", row.prospect_id, upErr.message);
}

async function isFlowEnabled(): Promise<boolean> {
  const { isFlowConfigured } = await import("@/lib/flow/flow.server");
  return isFlowConfigured();
}

function paymentState(payment: PaymentRow | null, flow: boolean): PublicPaymentState {
  if (!payment || payment.status === "cancelled") return { state: "transfer" };
  if (payment.status === "paid") return { state: "paid" };
  if (!flow) return { state: "transfer" };
  return { state: "flow", paymentUrl: payment.provider === "flow" ? payment.payment_url : null };
}

async function resolvePayment(row: ProposalRow, opts: { create: boolean }): Promise<PublicPaymentState> {
  if (row.amount_clp <= 0) return { state: "none" };
  if (!row.client_id) return { state: "contact" };
  const flow = await isFlowEnabled();
  let payment = await findProposalPayment(row);
  if (!payment && opts.create) payment = await createProposalPayment({ ...row, client_id: row.client_id });
  return paymentState(payment, flow);
}

// ------------------------------------------------------------------ API

/** enviada → vista solo si parece una persona (ver viewTracking.ts). */
async function markViewedIfHuman(token: string, status: string, signal: ViewSignal): Promise<boolean> {
  if (status !== "enviada" || !decideMarkViewed(signal).mark) return false;
  try {
    return (await rpc("mark_proposal_viewed", { _token: token })) === true;
  } catch (e) {
    // "Vista" es solo una señal: si falla no se bloquea la página.
    console.error("[proposals] no se pudo marcar vista", e);
    return false;
  }
}

export async function loadPublicProposal(token: string, signal: ViewSignal): Promise<PublicProposalResult> {
  const res = (await rpc("get_proposal_by_token", { _token: token })) as
    | { ok?: boolean; proposal?: Record<string, unknown> }
    | null;
  if (!res?.ok || !res.proposal) return { ok: false };
  const loaded = toPublic(res.proposal);
  const proposal = (await markViewedIfHuman(token, loaded.status, signal)) ? { ...loaded, status: "vista" } : loaded;

  if (proposal.status !== "aceptada") return { ok: true, proposal, payment: null };
  const row = await loadRow(token);
  const payment = row ? await resolvePayment(row, { create: false }) : null;
  return { ok: true, proposal, payment };
}

export type AcceptResult =
  | { ok: true; already: boolean; payment: PublicPaymentState }
  | { ok: false; reason: "invalid" | "name_required" | "expirada" | "rechazada" | "aceptada" | "error"; message?: string };

/** Texto que se agrega al texto aceptado: condiciones visibles y RUT declarado. */
function acceptanceAddendum(row: ProposalRow, rut: string | null): string {
  const conditions = proposalConditions(row.plan_key, parseItems(row.items)).join(" ");
  const rutText = rut ? ` RUT declarado: ${rut}.` : "";
  return ` Condiciones aceptadas: ${conditions}${rutText}`;
}

export async function acceptPublicProposal(input: {
  token: string;
  name: string;
  rut: string | null;
  email: string | null;
  ipHash: string | null;
}): Promise<AcceptResult> {
  const res = (await rpc("accept_proposal", { _token: input.token, _name: input.name, _ip_hash: input.ipHash })) as {
    ok?: boolean;
    already?: boolean;
    reason?: string;
  } | null;
  if (!res?.ok) {
    const reason = res?.reason;
    const known = ["invalid", "name_required", "expirada", "rechazada", "aceptada"] as const;
    return { ok: false, reason: (known as readonly string[]).includes(reason ?? "") ? (reason as (typeof known)[number]) : "invalid" };
  }
  const already = Boolean(res.already);
  const row = await loadRow(input.token);
  if (!row) return { ok: false, reason: "invalid" };

  if (!already) {
    await appendAcceptanceText(row, input.rut);
    if (!row.client_id) await noteOnProspect(row, input.name);
  }

  try {
    const payment = await resolvePayment(row, { create: true });
    if (payment.state === "flow" && !payment.paymentUrl) {
      const url = await tryCreateFlowLink(row, input.email);
      return { ok: true, already, payment: { state: "flow", paymentUrl: url } };
    }
    return { ok: true, already, payment };
  } catch (e) {
    console.error("[proposals] aceptada pero falló el cobro", row.id, e);
    return { ok: true, already, payment: { state: "transfer" } };
  }
}

async function appendAcceptanceText(row: ProposalRow, rut: string | null): Promise<void> {
  const db = await admin();
  const { data, error: readErr } = await db.from("proposals").select("accepted_text").eq("id", row.id).single();
  if (readErr || !data?.accepted_text) {
    console.error("[proposals] no se pudo leer el texto aceptado", row.id, readErr?.message);
    return;
  }
  const { error } = await db
    .from("proposals")
    .update({ accepted_text: `${data.accepted_text}${acceptanceAddendum(row, rut)}` })
    .eq("id", row.id)
    .eq("status", "aceptada")
    .eq("accepted_text", data.accepted_text);
  if (error) console.error("[proposals] no se pudo completar el texto aceptado", row.id, error.message);
}

/** Crea (o reutiliza) el link de Flow. null si no se pudo (p. ej. falta email). */
async function tryCreateFlowLink(row: ProposalRow, email: string | null): Promise<string | null> {
  try {
    const result = await startPaymentForRow(row, email);
    return result.state === "link" ? result.paymentUrl : null;
  } catch (e) {
    console.error("[proposals] no se pudo crear el link de Flow", row.id, e instanceof Error ? e.message : e);
    return null;
  }
}

export type StartPaymentResult =
  | { state: "link"; paymentUrl: string }
  | { state: "already_paid" }
  | { state: "unavailable"; message: string };

async function startPaymentForRow(row: ProposalRow, email: string | null): Promise<StartPaymentResult> {
  if (row.status !== "aceptada") return { state: "unavailable", message: "La propuesta aún no está aceptada." };
  if (!(await isFlowEnabled())) {
    return { state: "unavailable", message: "El pago en línea no está disponible. Te enviaremos los datos de pago." };
  }
  const payment = await findProposalPayment(row);
  if (!payment) return { state: "unavailable", message: "Aún no hay un cobro asociado. Te contactaremos para el pago." };
  if (payment.status === "paid") return { state: "already_paid" };
  const { ensurePaymentLink } = await import("@/lib/flow/payments.server");
  const result = await ensurePaymentLink(payment, email);
  return result.state === "link" ? { state: "link", paymentUrl: result.paymentUrl } : { state: "already_paid" };
}

/** "Pagar ahora": genera o reutiliza el link de Flow del cobro de la propuesta. */
export async function startProposalPayment(token: string, email: string | null): Promise<StartPaymentResult> {
  const row = await loadRow(token);
  if (!row) return { state: "unavailable", message: "Este link no es válido." };
  try {
    return await startPaymentForRow(row, email);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    console.error("[proposals] falló Pagar ahora", row.id, message);
    if (/email/i.test(message)) {
      return { state: "unavailable", message: "Ingresa tu email para generar el link de pago." };
    }
    return { state: "unavailable", message: "No pudimos generar el link de pago. Te contactaremos con los datos." };
  }
}

