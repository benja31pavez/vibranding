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
import { createRateLimiter } from "@/lib/security/ipRateLimit.server";
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

interface DbError {
  code?: string;
  message: string;
}

/** rpc sin tipar que devuelve el error (con code) en vez de lanzar. */
async function rpcRaw(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: DbError | null }> {
  const db = await admin();
  return (db as unknown as {
    rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: DbError | null }>;
  }).rpc(fn, args);
}

/**
 * La función `fn` (o su firma con esos argumentos) no existe: migración v3 sin aplicar.
 * Solo PGRST202, o 42883 que nombre a `fn`; cualquier otro error se propaga.
 */
function isMissingFunction(error: DbError | null, fn: string): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  return error.code === "42883" && error.message.includes(fn);
}

/** La columna no existe (p. ej. payments.proposal_id antes de la v3). */
function isMissingColumn(error: DbError | null): boolean {
  return Boolean(error) && (error?.code === "PGRST204" || error?.code === "42703");
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpcRaw(fn, args);
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

/**
 * Referencia visible de la propuesta en la descripción del cobro. El vínculo es
 * payments.proposal_id (v3); la marca sirve para cobros anteriores a la v3 y como
 * respaldo si la columna aún no existe.
 */
export function paymentRef(proposalId: string): string {
  return `ref P-${proposalId.slice(0, 8)}`;
}

const PAYMENT_LOOKUP_ERROR = "No pudimos revisar el estado del pago.";

/** Cobro de la propuesta por payments.proposal_id. "missing" si la columna no existe. */
async function findByProposalId(row: ProposalRow & { client_id: string }): Promise<PaymentRow | null | "missing"> {
  const db = await admin();
  const { data, error } = await db
    .from("payments")
    .select("*")
    .eq("client_id", row.client_id)
    .eq("proposal_id", row.id)
    .limit(1);
  if (isMissingColumn(error)) return "missing";
  if (error) {
    console.error("[proposals] no se pudo buscar el cobro", row.id, error.message);
    throw new Error(PAYMENT_LOOKUP_ERROR);
  }
  return data?.[0] ?? null;
}

/** Cobro de la propuesta por la marca en la descripción (cobros previos a la v3). */
async function findByDescription(row: ProposalRow & { client_id: string }): Promise<PaymentRow | null> {
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
    throw new Error(PAYMENT_LOOKUP_ERROR);
  }
  return data?.[0] ?? null;
}

async function findProposalPayment(row: ProposalRow): Promise<PaymentRow | null> {
  if (!row.client_id) return null;
  const withClient = { ...row, client_id: row.client_id };
  const byId = await findByProposalId(withClient);
  if (byId && byId !== "missing") return byId;
  return findByDescription(withClient);
}

export class AmountMismatchError extends Error {
  constructor() {
    super("El total de los ítems no coincide con el monto de la propuesta");
    this.name = "AmountMismatchError";
  }
}

async function createProposalPayment(row: ProposalRow & { client_id: string }): Promise<PaymentRow> {
  const totals = computeTotals(parseItems(row.items));
  // Con la v3 el trigger t_proposals_amount recalcula amount_clp desde los ítems; se
  // valida igual por si hay propuestas anteriores con montos desalineados.
  if (totals.firstCharge !== row.amount_clp || totals.firstCharge <= 0) {
    console.error("[proposals] [ALERTA] monto de la propuesta no coincide con sus ítems; no se crea el cobro", {
      proposalId: row.id,
      amountClp: row.amount_clp,
      itemsTotal: totals.firstCharge,
    });
    throw new AmountMismatchError();
  }
  const kind = chargeKind(totals);
  const today = todayInChile();
  const what = kind === "mensual" ? "primer mes" : "pago único";
  const values = {
    client_id: row.client_id,
    amount: totals.firstCharge,
    currency: "CLP",
    status: "pending" as const,
    kind,
    period: kind === "mensual" ? firstDayOfMonth(today) : null,
    due_date: today,
    description: `Propuesta "${noteSafe(row.title ?? "Vibranding", 80)}" (${what}) · ${paymentRef(row.id)}`,
  };
  const db = await admin();
  // Servidor (service role): proposal_id no está en los GRANT del navegador (v3b).
  let { data, error } = await db
    .from("payments")
    .insert({ ...values, proposal_id: row.id })
    .select("*")
    .single();
  if (isMissingColumn(error)) {
    ({ data, error } = await db.from("payments").insert(values).select("*").single());
  }
  if (error?.code === "23505") {
    // payments_proposal_uk: otro request ya creó el cobro de esta propuesta.
    const existing = await findProposalPayment(row);
    if (existing) return existing;
  }
  if (error || !data) {
    console.error("[proposals] no se pudo crear el cobro", row.id, error?.message);
    throw new Error("Tu aceptación quedó registrada, pero no pudimos generar el cobro. Te contactaremos.");
  }
  return data;
}

/** Texto apto para notas: sin caracteres de control ni saltos de línea, recortado. */
function noteSafe(text: string, max: number): string {
  return text.replace(/[\p{Cc}\p{Cf}\u2028\u2029]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** append_prospect_note recorta a 300 caracteres; con el prefijo la nota cabe entera. */
const NOTE_MAX = 260;

/**
 * Agrega una nota al destinatario (prospects.notas o clients.notes), prefijada
 * con "[Propuesta AAAA-MM-DD]" y recortada. proposals no tiene columna de notas.
 * Prospectos: append_prospect_note (v3, atómico); si no existe, leer-modificar-escribir.
 */
async function appendRecipientNote(row: ProposalRow, text: string): Promise<void> {
  const note = `[Propuesta ${todayInChile()}] ${noteSafe(text, NOTE_MAX)}`;
  if (!row.client_id && row.prospect_id) {
    const { data, error } = await rpcRaw("append_prospect_note", { _prospect_id: row.prospect_id, _note: note });
    if (!error) {
      if (data !== true) console.error("[proposals] no se encontró el prospecto para anotar", row.prospect_id);
      return;
    }
    if (!isMissingFunction(error, "append_prospect_note")) {
      console.error("[proposals] no se pudo anotar", "prospects", row.prospect_id, error.message);
      return;
    }
  }
  await appendNoteReadWrite(row, note);
}

/** Respaldo sin la v3 (y para clients.notes): leer-modificar-escribir. */
async function appendNoteReadWrite(row: ProposalRow, note: string): Promise<void> {
  const db = await admin();
  const target = row.client_id
    ? ({ table: "clients", column: "notes", id: row.client_id } as const)
    : row.prospect_id
      ? ({ table: "prospects", column: "notas", id: row.prospect_id } as const)
      : null;
  if (!target) return;
  const { data, error } = await (db.from(target.table) as any).select(target.column).eq("id", target.id).maybeSingle();
  if (error) {
    console.error("[proposals] no se pudo leer las notas", target.table, target.id, error.message);
    return;
  }
  const current = ((data as Record<string, string | null> | null)?.[target.column] ?? "").trim();
  const next = current ? `${current}\n${note}` : note;
  const { error: upErr } = await (db.from(target.table) as any).update({ [target.column]: next }).eq("id", target.id);
  if (upErr) console.error("[proposals] no se pudo anotar", target.table, target.id, upErr.message);
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

/**
 * Estado del pago. `create` SOLO es true para una aceptación nueva
 * (accept_proposal con already=false): su FOR UPDATE serializa, así que un
 * único request crea el cobro. Con already=true solo se busca, nunca se crea.
 */
async function resolvePayment(row: ProposalRow, opts: { create: boolean }): Promise<PublicPaymentState> {
  if (row.amount_clp <= 0) return { state: "none" };
  if (!row.client_id) return { state: "contact" };
  const flow = await isFlowEnabled();
  const existing = await findProposalPayment(row);
  const payment =
    existing ?? (opts.create ? await createProposalPayment({ ...row, client_id: row.client_id }) : null);
  return paymentState(payment, flow);
}

// ------------------------------------------------------------------ API

const TEN_MINUTES = 10 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
/** Como máximo 1 intento de marcar "vista" por token cada 10 min (en memoria). */
const viewMarkLimiter = createRateLimiter(1, TEN_MINUTES);
/** Como máximo 3 intentos de link de Flow por token por hora (en memoria). */
const flowLinkLimiter = createRateLimiter(3, HOUR);

/** enviada → vista solo si parece una persona (ver viewTracking.ts). */
async function markViewedIfHuman(token: string, status: string, signal: ViewSignal): Promise<boolean> {
  if (status !== "enviada" || !decideMarkViewed(signal).mark) return false;
  if (!viewMarkLimiter.allow(`view-mark:${token}`)) return false;
  try {
    return (await rpc("mark_proposal_viewed", { _token: token })) === true;
  } catch (e) {
    // "Vista" es solo una señal: si falla no se bloquea la página.
    console.error("[proposals] no se pudo marcar vista", e);
    return false;
  }
}

const TOKEN_RE = /^[0-9a-f]{48}$/;

export async function loadPublicProposal(token: string, signal: ViewSignal): Promise<PublicProposalResult> {
  if (!TOKEN_RE.test(token)) return { ok: false };
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

type AcceptRpcResult = { ok?: boolean; already?: boolean; reason?: string } | null;

/**
 * accept_proposal de la v3 recibe RUT y condiciones y los guarda en la misma
 * transacción. Si esa firma no existe (antes de la v3), se llama la de 3 argumentos
 * y `legacy` indica que hay que completar el texto aceptado aparte.
 */
async function callAcceptProposal(
  input: { token: string; name: string; rut: string | null; ipHash: string | null },
  extraText: string,
): Promise<{ res: AcceptRpcResult; legacy: boolean }> {
  const base = { _token: input.token, _name: input.name, _ip_hash: input.ipHash };
  const { data, error } = await rpcRaw("accept_proposal", { ...base, _rut: input.rut, _extra_text: extraText });
  if (!error) return { res: data as AcceptRpcResult, legacy: false };
  if (!isMissingFunction(error, "accept_proposal")) {
    console.error("[proposals] accept_proposal falló", error.message);
    throw new Error("No pudimos cargar la propuesta. Intenta de nuevo en unos minutos.");
  }
  return { res: (await rpc("accept_proposal", base)) as AcceptRpcResult, legacy: true };
}

/** Condiciones aceptadas (texto adicional de accept_proposal). */
function conditionsText(row: ProposalRow): string {
  return `Condiciones aceptadas: ${proposalConditions(row.plan_key, parseItems(row.items)).join(" ")}`;
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
  // Una sola lectura: plan, ítems, cliente y prospecto no cambian al aceptar.
  const loaded = await loadRow(input.token);
  if (!loaded) return { ok: false, reason: "invalid" };
  const { res, legacy } = await callAcceptProposal(input, conditionsText(loaded));
  if (!res?.ok) {
    const reason = res?.reason;
    if (reason === "invalid_rut") return { ok: false, reason: "error", message: "El RUT no es válido. Revísalo e intenta de nuevo." };
    const known = ["invalid", "name_required", "expirada", "rechazada", "aceptada"] as const;
    return { ok: false, reason: (known as readonly string[]).includes(reason ?? "") ? (reason as (typeof known)[number]) : "invalid" };
  }
  const already = Boolean(res.already);
  const row: ProposalRow = { ...loaded, status: "aceptada" };

  if (!already) {
    if (legacy) await appendAcceptanceText(row, input.rut);
    if (!row.client_id) {
      await appendRecipientNote(row, `Aceptó "${row.title ?? ""}" (${input.name}). Falta crear el cliente y el cobro.`);
    }
  }

  try {
    const payment = await resolvePayment(row, { create: !already });
    if (payment.state === "flow" && !payment.paymentUrl) {
      const url = await tryCreateFlowLink(input.token, row, input.email);
      return { ok: true, already, payment: { state: "flow", paymentUrl: url } };
    }
    return { ok: true, already, payment };
  } catch (e) {
    console.error("[proposals] aceptada pero falló el cobro", row.id, e instanceof Error ? e.message : e);
    return { ok: true, already, payment: { state: "transfer" } };
  }
}

/**
 * Solo sin la v3: agrega condiciones y RUT al texto aceptado (update condicionado
 * al texto leído). Reintenta una vez; si sigue fallando deja una nota en el
 * destinatario y un log [ALERTA]. Con la v3 accept_proposal recibe _rut y
 * _extra_text y lo guarda en la misma transacción.
 */
async function appendAcceptanceText(row: ProposalRow, rut: string | null): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (await tryAppendAcceptanceText(row, rut)) return;
  }
  console.error("[proposals] [ALERTA] no se pudo completar el texto aceptado", row.id);
  await appendRecipientNote(
    row,
    `No se pudo guardar el detalle de condiciones${rut ? ` y RUT ${rut}` : ""} en la aceptación de "${row.title ?? ""}". Revisar.`,
  );
}

async function tryAppendAcceptanceText(row: ProposalRow, rut: string | null): Promise<boolean> {
  const db = await admin();
  const { data, error: readErr } = await db.from("proposals").select("accepted_text").eq("id", row.id).single();
  if (readErr || !data?.accepted_text) {
    console.error("[proposals] no se pudo leer el texto aceptado", row.id, readErr?.message);
    return false;
  }
  if (data.accepted_text.includes(" Condiciones aceptadas: ")) return true;
  const { data: updated, error } = await db
    .from("proposals")
    .update({ accepted_text: `${data.accepted_text}${acceptanceAddendum(row, rut)}` })
    .eq("id", row.id)
    .eq("status", "aceptada")
    .eq("accepted_text", data.accepted_text)
    .select("id");
  if (error) {
    console.error("[proposals] no se pudo completar el texto aceptado", row.id, error.message);
    return false;
  }
  return (updated?.length ?? 0) > 0;
}

/** Crea (o reutiliza) el link de Flow. null si no se pudo (p. ej. falta email). */
async function tryCreateFlowLink(token: string, row: ProposalRow, email: string | null): Promise<string | null> {
  try {
    const result = await startPaymentForRow(token, row, email);
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

/**
 * Pagador: el email del portal del cliente si existe; el escrito en la página
 * solo si no hay ninguno. Máximo 3 intentos de link por token por hora.
 */
async function startPaymentForRow(token: string, row: ProposalRow, email: string | null): Promise<StartPaymentResult> {
  if (row.status !== "aceptada") return { state: "unavailable", message: "La propuesta aún no está aceptada." };
  if (!(await isFlowEnabled())) {
    return { state: "unavailable", message: "El pago en línea no está disponible. Te enviaremos los datos de pago." };
  }
  const payment = await findProposalPayment(row);
  if (!payment) return { state: "unavailable", message: "Aún no hay un cobro asociado. Te contactaremos para el pago." };
  if (payment.status === "paid") return { state: "already_paid" };
  if (!flowLinkLimiter.allow(`flow-link:${token}`)) {
    return { state: "unavailable", message: "Ya generamos varios links de pago. Intenta de nuevo en una hora o escríbenos." };
  }
  const { ensurePaymentLink, defaultPayerEmail } = await import("@/lib/flow/payments.server");
  const payer = (await defaultPayerEmail(payment.client_id)) ?? email;
  const result = await ensurePaymentLink(payment, payer);
  return result.state === "link" ? { state: "link", paymentUrl: result.paymentUrl } : { state: "already_paid" };
}

/** "Pagar ahora": genera o reutiliza el link de Flow del cobro de la propuesta. */
export async function startProposalPayment(token: string, email: string | null): Promise<StartPaymentResult> {
  const row = await loadRow(token);
  if (!row) return { state: "unavailable", message: "Este link no es válido." };
  try {
    return await startPaymentForRow(token, row, email);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    console.error("[proposals] falló Pagar ahora", row.id, message);
    if (/email/i.test(message)) {
      return { state: "unavailable", message: "Ingresa tu email para generar el link de pago." };
    }
    return { state: "unavailable", message: "No pudimos generar el link de pago. Te contactaremos con los datos." };
  }
}

