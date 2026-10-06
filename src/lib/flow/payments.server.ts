/**
 * Lógica de cobro online con Flow sobre la tabla `payments`.
 * Solo servidor: usa el service role, así que quien llame debe haber validado
 * antes el acceso (assertCanEditClient) o la autenticidad (getStatus firmado).
 */
import type { Database } from "@/integrations/supabase/types";
import { todayInChile } from "@/lib/billing/dates";
import { publicOrigin } from "@/lib/meta/oauth.server";
import {
  FLOW_STATUS,
  createFlowPayment,
  getFlowPaymentStatus,
  type FlowPaymentStatus,
} from "./flow.server";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

const OPEN_STATUSES: readonly PaymentRow["status"][] = ["pending", "overdue"];

/**
 * Vigencia de la orden en Flow (parámetro `timeout` de payment/create, en
 * segundos según apiFlow.yaml). Sin él la orden no expira nunca y un link
 * viejo podría pagarse meses después.
 */
export const FLOW_ORDER_TIMEOUT_SECONDS = 7 * 24 * 60 * 60;
/**
 * No se reutiliza un link al que le quede menos de esto: se genera uno nuevo.
 * El margen cubre que la zona horaria de requestDate no está documentada.
 */
const REUSE_MARGIN_SECONDS = 24 * 60 * 60;

/** Segundos desde requestDate ("yyyy-mm-dd hh:mm:ss"); null si no se puede leer. */
function orderAgeSeconds(requestDate: string | undefined, now = Date.now()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(requestDate ?? "");
  if (!m) return null;
  const ts = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Math.floor((now - ts) / 1000);
}

function reusable(status: FlowPaymentStatus): boolean {
  const age = orderAgeSeconds(status.requestDate);
  return age !== null && age < FLOW_ORDER_TIMEOUT_SECONDS - REUSE_MARGIN_SECONDS;
}

export const FLOW_CONFIRM_PATH = "/api/public/flow/confirm";
export const FLOW_RETURN_PATH = "/api/public/flow/return";

/**
 * commerceOrder = payment.id. Si hay que regenerar el link (orden rechazada o
 * anulada en Flow) se agrega un sufijo ".xxxx", porque no está verificado que
 * Flow acepte repetir un commerceOrder.
 */
export function commerceOrderMatches(commerceOrder: string, paymentId: string): boolean {
  return commerceOrder === paymentId || commerceOrder.startsWith(`${paymentId}.`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadPayment(paymentId: string): Promise<PaymentRow | null> {
  const db = await admin();
  const { data, error } = await db.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (error) {
    console.error("[flow] no se pudo leer el pago", paymentId, error.message);
    throw new Error("No se pudo leer el cobro");
  }
  return data;
}

/** "2026-10-04 12:32:11" → "2026-10-04"; si no viene, hoy en Chile. */
function paidDate(status: FlowPaymentStatus): string {
  const raw = status.paymentData?.date ?? "";
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : todayInChile();
}

/**
 * - paid / already_paid: el cobro quedó (o ya estaba) pagado con esta orden.
 * - duplicate: el cobro ya estaba pagado con OTRA orden de Flow (posible pago doble).
 * - mismatch: la orden no corresponde al cobro (commerceOrder, monto o moneda).
 */
export type ApplyResult =
  | "paid"
  | "already_paid"
  | "duplicate"
  | "pending"
  | "rejected"
  | "mismatch";

/** Id del cobro a partir del commerceOrder ("<uuid>" o "<uuid>.<sufijo>"). */
export function paymentIdFromCommerceOrder(commerceOrder: string): string | null {
  const id = commerceOrder.split(".")[0] ?? "";
  return UUID_RE.test(id) ? id : null;
}

/**
 * Aplica a `payment` el estado que Flow reportó para su orden. Nunca se llama
 * con datos del navegador: `status` sale de getStatus firmado.
 * Idempotente: un cobro ya pagado no se vuelve a tocar.
 */
export async function applyFlowStatus(
  payment: PaymentRow,
  status: FlowPaymentStatus,
): Promise<ApplyResult> {
  if (!commerceOrderMatches(String(status.commerceOrder ?? ""), payment.id)) {
    console.error("[flow][ALERTA] commerceOrder no coincide", {
      paymentId: payment.id,
      commerceOrder: status.commerceOrder,
      flowOrder: status.flowOrder,
    });
    return "mismatch";
  }
  if (status.status !== FLOW_STATUS.PAID) {
    return status.status === FLOW_STATUS.PENDING ? "pending" : "rejected";
  }
  const flowOrder = String(status.flowOrder);
  if (payment.status === "paid") return resolveAlreadyPaid(payment, status);

  const sameAmount = Math.round(Number(status.amount)) === Math.round(Number(payment.amount));
  if (!sameAmount || String(status.currency).toUpperCase() !== "CLP") {
    console.error("[flow][ALERTA] pago recibido con monto/moneda distintos; no se marca pagado", {
      flowOrder,
      paymentId: payment.id,
      flow: { amount: status.amount, currency: status.currency },
      local: { amount: payment.amount, currency: payment.currency },
    });
    return "mismatch";
  }

  if (payment.status === "cancelled") {
    console.warn("[flow] cobro cancelado recibió un pago en Flow; se marca pagado", {
      paymentId: payment.id,
      flowOrder,
    });
  }

  const db = await admin();
  const { data, error } = await db
    .from("payments")
    .update({
      status: "paid",
      paid_at: paidDate(status),
      provider: "flow",
      provider_ref: flowOrder,
    })
    .eq("id", payment.id)
    .neq("status", "paid")
    .select("id");
  if (error) {
    console.error("[flow] no se pudo marcar pagado", payment.id, error.message);
    throw new Error("No se pudo registrar el pago");
  }
  if (data && data.length > 0) {
    if (payment.status === "cancelled" && (payment.plan_key || payment.addon_key)) {
      await flagCancelledPlanPayment(payment, status);
    }
    return "paid";
  }

  // 0 filas: otra petición lo marcó pagado entre medio. ¿Con esta misma orden?
  const latest = await loadPayment(payment.id);
  if (!latest) throw new Error("El cobro desapareció mientras se registraba el pago");
  return resolveAlreadyPaid(latest, status);
}

/**
 * Pago de un cobro de PLAN que ya estaba cancelado (p. ej. pestaña vieja de Flow
 * después de elegir otro plan). Queda pagado; el trigger
 * t_payments_membership_period no le da período si ya hay uno vigente o un pago
 * de plan posterior. Se deja una anomalía para que la agencia lo revise.
 */
async function flagCancelledPlanPayment(
  payment: PaymentRow,
  status: FlowPaymentStatus,
): Promise<void> {
  const db = await admin();
  const latest = await loadPayment(payment.id).catch(() => null);
  const periodCreated = Boolean(latest?.period_start);
  console.error("[flow][ALERTA] pago duplicado de plan, revisar", {
    paymentId: payment.id,
    planKey: payment.plan_key,
    flowOrder: status.flowOrder,
    periodCreated,
  });
  const { error } = await db.from("payment_anomalies").insert({
    payment_id: payment.id,
    kind: "cancelled_paid",
    provider: "flow",
    flow_order: String(status.flowOrder),
    commerce_order: String(status.commerceOrder ?? ""),
    amount: Number(status.amount),
    currency: String(status.currency ?? "CLP"),
    detail: {
      message: "Pago duplicado de plan, revisar",
      plan_key: payment.plan_key,
      period_created: periodCreated,
    },
  });
  if (error && error.code !== "23505") {
    console.error("[flow][ALERTA] no se pudo registrar la anomalía", payment.id, error.message);
  }
}

const DUPLICATE_MARK = "[PAGO DUPLICADO";

/**
 * Cobro ya pagado que recibe otra orden pagada en Flow (o que se marcó pagado
 * a mano): posible pago doble. Alerta en el log y deja una nota visible en
 * payments.description (no hay tabla de anomalías todavía; ver SQL del PR).
 */
async function resolveAlreadyPaid(
  payment: PaymentRow,
  status: FlowPaymentStatus,
): Promise<"already_paid" | "duplicate"> {
  const flowOrder = String(status.flowOrder);
  if (payment.provider_ref === flowOrder) return "already_paid";

  console.error("[flow][ALERTA] posible pago doble: el cobro ya estaba pagado con otra orden", {
    paymentId: payment.id,
    paidWith: payment.provider_ref ?? `(${payment.provider ?? "sin proveedor"})`,
    newFlowOrder: flowOrder,
    amount: status.amount,
    currency: status.currency,
  });

  const note = `${DUPLICATE_MARK} flowOrder=${flowOrder}]`;
  const current = payment.description ?? "";
  if (current.includes(note)) return "duplicate";
  const db = await admin();
  const { error } = await db
    .from("payments")
    .update({ description: current ? `${current} ${note}` : note })
    .eq("id", payment.id);
  if (error) {
    console.error("[flow][ALERTA] no se pudo anotar el pago duplicado", payment.id, error.message);
  }
  return "duplicate";
}

/** Email del portal del cliente, si existe, como pagador por defecto. */
export async function defaultPayerEmail(clientId: string): Promise<string | null> {
  const db = await admin();
  const { data, error } = await db
    .from("client_users")
    .select("email")
    .eq("client_id", clientId)
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) {
    console.error("[flow] no se pudo leer el email del portal", clientId, error.message);
    return null;
  }
  return data?.[0]?.email ?? null;
}

export type PaymentLinkResult =
  | { state: "link"; paymentUrl: string; reused: boolean }
  | { state: "already_paid" };

function assertChargeable(payment: PaymentRow): number {
  if (!OPEN_STATUSES.includes(payment.status)) {
    throw new Error("Solo se puede generar link para cobros pendientes o vencidos");
  }
  if ((payment.currency ?? "").toUpperCase() !== "CLP") {
    throw new Error("Flow solo se usa para cobros en CLP");
  }
  const amount = Number(payment.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("El monto debe ser un entero positivo en CLP");
  }
  return amount;
}

/**
 * Devuelve el link de pago de un cobro, creándolo en Flow si hace falta.
 * Idempotente: si ya hay una orden de Flow pendiente, reutiliza su link.
 */
export async function ensurePaymentLink(
  payment: PaymentRow,
  email: string | null,
): Promise<PaymentLinkResult> {
  const amount = assertChargeable(payment);

  let regenerate = false;
  if (payment.provider === "flow" && payment.flow_token && payment.payment_url) {
    const current = await getFlowPaymentStatus(payment.flow_token);
    if (current.status === FLOW_STATUS.PENDING && reusable(current)) {
      return { state: "link", paymentUrl: payment.payment_url, reused: true };
    }
    if (current.status === FLOW_STATUS.PAID) {
      const applied = await applyFlowStatus(payment, current);
      if (applied === "paid" || applied === "already_paid" || applied === "duplicate") {
        return { state: "already_paid" };
      }
      throw new Error("Flow reporta un pago que no coincide con este cobro; revísalo en Flow");
    }
    // Rechazada, anulada o por expirar: orden nueva. La anterior no se pierde:
    // si igual se paga, el webhook la resuelve por su commerceOrder.
    regenerate = true;
  }

  const payer = email?.trim() || (await defaultPayerEmail(payment.client_id));
  if (!payer) {
    throw new Error("Flow exige el email del pagador: ingrésalo para generar el link");
  }

  const origin = publicOrigin();
  const created = await createFlowPayment({
    commerceOrder: regenerate ? `${payment.id}.${Date.now().toString(36)}` : payment.id,
    subject: payment.description?.trim() || "Servicios VIBRANDING",
    amount,
    email: payer,
    urlConfirmation: `${origin}${FLOW_CONFIRM_PATH}`,
    urlReturn: `${origin}${FLOW_RETURN_PATH}`,
    timeout: FLOW_ORDER_TIMEOUT_SECONDS,
  });

  const db = await admin();
  // Guardado condicional: si otro clic guardó un link entre medio, gana el primero.
  const base = db
    .from("payments")
    .update({ provider: "flow", flow_token: created.token, payment_url: created.paymentUrl })
    .eq("id", payment.id)
    .in("status", [...OPEN_STATUSES]);
  const guarded = payment.flow_token
    ? base.eq("flow_token", payment.flow_token)
    : base.is("flow_token", null);
  const { data, error } = await guarded.select("id");
  if (error) {
    console.error("[flow] no se pudo guardar el link", payment.id, error.message);
    throw new Error("Se creó la orden en Flow pero no se pudo guardar el link");
  }
  if (!data || data.length === 0) {
    const latest = await loadPayment(payment.id);
    if (latest?.status === "paid") return { state: "already_paid" };
    if (latest?.payment_url) return { state: "link", paymentUrl: latest.payment_url, reused: true };
    throw new Error("El cobro cambió mientras se generaba el link; vuelve a intentarlo");
  }
  return { state: "link", paymentUrl: created.paymentUrl, reused: false };
}
