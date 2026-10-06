/**
 * Membresía autogestionada: lectura del estado y "Contratar y pagar" / "Renovar".
 * Solo servidor: usa el service role, así que quien llame debe haber validado
 * antes el acceso al cliente (ver membership.functions.ts).
 *
 * El monto SIEMPRE sale de plans.ts (precio de lista + IVA): nunca del navegador.
 */
import { todayInChile } from "./dates";
import { deriveMembership, purchaseBlockedReason, type Membership } from "./membership";
import { findPlan, planTotal, type Plan, type PlanKey } from "@/lib/pricing/plans";
import type { Database } from "@/integrations/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

const OPEN_STATUSES = ["pending", "overdue"] as const;
const UNIQUE_VIOLATION = "23505";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Estado derivado de los pagos de plan confirmados del cliente. */
export async function loadMembership(
  clientId: string,
  today: string = todayInChile(),
): Promise<Membership> {
  const db = await admin();
  const { data, error } = await db
    .from("payments")
    .select("status,plan_key,paid_at,period_start,period_end")
    .eq("client_id", clientId)
    .eq("status", "paid")
    .not("plan_key", "is", null);
  if (error) {
    console.error("[membresía] no se pudieron leer los pagos", clientId, error.message);
    throw new Error("No pudimos cargar tu plan. Intenta de nuevo.");
  }
  return deriveMembership(data ?? [], today);
}

/** Correo para Flow: facturación de la ficha, contacto o usuario del portal. */
export async function clientPayerEmail(clientId: string): Promise<string | null> {
  const db = await admin();
  const { data, error } = await db
    .from("client_intake")
    .select("email_facturacion,contacto_email")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) console.warn("[membresía] no se pudo leer el contacto", clientId, error.message);
  const fromIntake = data?.email_facturacion?.trim() || data?.contacto_email?.trim();
  if (fromIntake) return fromIntake;
  const { defaultPayerEmail } = await import("@/lib/flow/payments.server");
  return defaultPayerEmail(clientId);
}

function checkoutValues(clientId: string, plan: Plan) {
  return {
    client_id: clientId,
    plan_key: plan.key,
    amount: planTotal(plan),
    currency: "CLP",
    status: "pending" as const,
    kind: plan.billing === "monthly" ? "mensual" : "unico",
    // Sin vencimiento: un pago abandonado no queda como deuda "Vencida".
    due_date: null,
    description: `${plan.label} · ${plan.billing === "monthly" ? "1 mes" : "pago único"}`,
  };
}

async function openCheckout(clientId: string): Promise<PaymentRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("payments")
    .select("*")
    .eq("client_id", clientId)
    .not("plan_key", "is", null)
    .is("proposal_id", null)
    .in("status", [...OPEN_STATUSES])
    .limit(1);
  if (error) {
    console.error("[membresía] no se pudo leer el cobro abierto", clientId, error.message);
    throw new Error("No pudimos preparar el pago. Intenta de nuevo.");
  }
  return data?.[0] ?? null;
}

/**
 * Cobro del plan elegido: reutiliza el abierto si es el mismo plan y monto;
 * si el abierto es de otro plan, lo cancela (un solo cobro de plan abierto).
 */
async function ensureCheckoutPayment(clientId: string, plan: Plan): Promise<PaymentRow> {
  const db = await admin();
  const open = await openCheckout(clientId);
  if (open && open.plan_key === plan.key && Number(open.amount) === planTotal(plan)) return open;
  if (open) {
    const { error } = await db
      .from("payments")
      .update({ status: "cancelled" })
      .eq("id", open.id)
      .in("status", [...OPEN_STATUSES]);
    if (error) {
      console.error("[membresía] no se pudo cancelar el cobro anterior", open.id, error.message);
      throw new Error("No pudimos preparar el pago. Intenta de nuevo.");
    }
  }
  const { data, error } = await db
    .from("payments")
    .insert(checkoutValues(clientId, plan))
    .select("*")
    .single();
  if (error?.code === UNIQUE_VIOLATION) {
    // Doble clic: otro request creó el cobro entre medio.
    const again = await openCheckout(clientId);
    if (again?.plan_key === plan.key) return again;
  }
  if (error || !data) {
    console.error("[membresía] no se pudo crear el cobro", clientId, error?.message);
    throw new Error("No pudimos preparar el pago. Intenta de nuevo.");
  }
  return data;
}

export type CheckoutResult =
  | { state: "link"; paymentUrl: string }
  | { state: "already_paid" }
  | { state: "need_email" };

export async function startMembershipCheckout(input: {
  clientId: string;
  planKey: PlanKey;
  email: string | null;
}): Promise<CheckoutResult> {
  const plan = findPlan(input.planKey);
  if (!plan) throw new Error("Ese plan no existe.");
  const membership = await loadMembership(input.clientId);
  const blocked = purchaseBlockedReason(membership, plan.key);
  if (blocked) throw new Error(blocked);

  const payer = input.email?.trim() || (await clientPayerEmail(input.clientId));
  if (!payer) return { state: "need_email" };

  const payment = await ensureCheckoutPayment(input.clientId, plan);
  const { ensurePaymentLink } = await import("@/lib/flow/payments.server");
  const result = await ensurePaymentLink(payment, payer);
  return result.state === "link"
    ? { state: "link", paymentUrl: result.paymentUrl }
    : { state: "already_paid" };
}
