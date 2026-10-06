/**
 * Membresía autogestionada: lectura del estado y "Contratar y pagar" / "Renovar".
 * Solo servidor: usa el service role, así que quien llame debe haber validado
 * antes el acceso al cliente (ver membership.functions.ts).
 *
 * El monto SIEMPRE sale de plans.ts / addons.ts (precio de lista + IVA, suma de
 * las líneas guardadas en payments.items): nunca del navegador.
 */
import { todayInChile } from "./dates";
import { deriveMembership, purchaseBlockedReason, type Membership } from "./membership";
import {
  addonBlockedReason,
  addonSetupItems,
  itemsTotal,
  parsePaymentItems,
  planChargeItems,
  type PaymentItem,
} from "./addons";
import { findAddon, isAddonKey, type Addon, type AddonKey } from "@/lib/pricing/addons";
import { findPlan, type Plan, type PlanKey } from "@/lib/pricing/plans";
import type { Database, Json } from "@/integrations/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"];

const OPEN_STATUSES = ["pending", "overdue"] as const;
const UNIQUE_VIOLATION = "23505";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Adicionales con mantención mensual activos del cliente (`client_addons`). */
export async function loadActiveAddons(clientId: string): Promise<AddonKey[]> {
  const db = await admin();
  const { data, error } = await db
    .from("client_addons")
    .select("addon_key")
    .eq("client_id", clientId)
    .eq("active", true);
  if (error) {
    console.error("[membresía] no se pudieron leer los adicionales", clientId, error.message);
    throw new Error("No pudimos cargar tus adicionales. Intenta de nuevo.");
  }
  return (data ?? []).map((r) => r.addon_key).filter(isAddonKey);
}

/** Estado derivado de los pagos de plan confirmados del cliente. */
export async function loadMembership(
  clientId: string,
  today: string = todayInChile(),
): Promise<Membership> {
  const db = await admin();
  const [payments, addons] = await Promise.all([
    db
      .from("payments")
      .select("status,plan_key,paid_at,period_start,period_end")
      .eq("client_id", clientId)
      .eq("status", "paid")
      .not("plan_key", "is", null),
    loadActiveAddons(clientId),
  ]);
  if (payments.error) {
    console.error("[membresía] no se pudieron leer los pagos", clientId, payments.error.message);
    throw new Error("No pudimos cargar tu plan. Intenta de nuevo.");
  }
  return deriveMembership(payments.data ?? [], today, addons);
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

/** Qué paga el cobro: un plan (membresía) o el pago único de un adicional. */
type Charge =
  | { kind: "plan"; plan: Plan; items: PaymentItem[] }
  | { kind: "addon"; addon: Addon; items: PaymentItem[] };

function chargeColumn(charge: Charge): "plan_key" | "addon_key" {
  return charge.kind === "plan" ? "plan_key" : "addon_key";
}

function chargeKey(charge: Charge): string {
  return charge.kind === "plan" ? charge.plan.key : charge.addon.key;
}

/** Fila del cobro. El monto es la suma de las líneas, calculada aquí (nunca del navegador). */
function checkoutValues(clientId: string, charge: Charge): PaymentInsert {
  const amount = itemsTotal(charge.items).total;
  const base = {
    client_id: clientId,
    amount,
    currency: "CLP",
    status: "pending" as const,
    // Sin vencimiento: un pago abandonado no queda como deuda "Vencida".
    due_date: null,
    items: charge.items as unknown as Json,
  };
  if (charge.kind === "addon") {
    return {
      ...base,
      addon_key: charge.addon.key,
      kind: "unico",
      description: `${charge.addon.label} · pago único`,
    };
  }
  const { plan } = charge;
  const extras = charge.items
    .slice(1)
    .map((i) => ` + ${findAddon(i.key)?.label ?? i.label}`)
    .join("");
  return {
    ...base,
    plan_key: plan.key,
    kind: plan.billing === "monthly" ? "mensual" : "unico",
    description: `${plan.label} · ${plan.billing === "monthly" ? "1 mes" : "pago único"}${extras}`,
  };
}

/** Cobro abierto del mismo tipo: uno por plan (cualquiera) y uno por cada adicional. */
async function openCheckout(clientId: string, charge: Charge): Promise<PaymentRow | null> {
  const db = await admin();
  const base = db
    .from("payments")
    .select("*")
    .eq("client_id", clientId)
    .is("proposal_id", null)
    .in("status", [...OPEN_STATUSES]);
  const { data, error } = await (
    charge.kind === "addon"
      ? base.eq("addon_key", charge.addon.key)
      : base.not("plan_key", "is", null)
  ).limit(1);
  if (error) {
    console.error("[membresía] no se pudo leer el cobro abierto", clientId, error.message);
    throw new Error("No pudimos preparar el pago. Intenta de nuevo.");
  }
  return data?.[0] ?? null;
}

function sameCharge(row: PaymentRow | null, charge: Charge): boolean {
  if (!row) return false;
  return (
    row[chargeColumn(charge)] === chargeKey(charge) &&
    Number(row.amount) === itemsTotal(charge.items).total
  );
}

/**
 * Cobro elegido: reutiliza el abierto si es el mismo plan/adicional y monto; si
 * el abierto es otro (u otro monto, p. ej. se activó el chatbot), lo cancela:
 * un solo cobro de plan y uno de adicional abiertos por cliente.
 */
async function ensureCheckoutPayment(clientId: string, charge: Charge): Promise<PaymentRow> {
  const db = await admin();
  const open = await openCheckout(clientId, charge);
  if (open && sameCharge(open, charge)) return open;
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
    .insert(checkoutValues(clientId, charge))
    .select("*")
    .single();
  if (error?.code === UNIQUE_VIOLATION) {
    // Doble clic: otro request creó el cobro entre medio.
    const again = await openCheckout(clientId, charge);
    if (again && sameCharge(again, charge)) return again;
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

async function payCharge(
  clientId: string,
  charge: Charge,
  email: string | null,
): Promise<CheckoutResult> {
  const payer = email?.trim() || (await clientPayerEmail(clientId));
  if (!payer) return { state: "need_email" };

  const payment = await ensureCheckoutPayment(clientId, charge);
  const { ensurePaymentLink } = await import("@/lib/flow/payments.server");
  const result = await ensurePaymentLink(payment, payer);
  return result.state === "link"
    ? { state: "link", paymentUrl: result.paymentUrl }
    : { state: "already_paid" };
}

/** Plan (y mantención de adicionales activos si es mensual) con el precio de plans.ts. */
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
  const items = planChargeItems(plan, membership.activeAddons);
  return payCharge(input.clientId, { kind: "plan", plan, items }, input.email);
}

/** Pago único de un adicional (configuración del chatbot o landing extra), precio de addons.ts. */
export async function startAddonCheckout(input: {
  clientId: string;
  addonKey: AddonKey;
  email: string | null;
}): Promise<CheckoutResult> {
  const addon = findAddon(input.addonKey);
  if (!addon) throw new Error("Ese adicional no existe.");
  const membership = await loadMembership(input.clientId);
  const blocked = addonBlockedReason(membership, addon);
  if (blocked) throw new Error(blocked);
  return payCharge(
    input.clientId,
    { kind: "addon", addon, items: addonSetupItems(addon) },
    input.email,
  );
}

/**
 * Baja de un adicional mensual (chatbot): deja de sumarse a la renovación y al
 * MRR (el trigger de client_addons recalcula client_billing). Sin devoluciones.
 */
export async function deactivateClientAddon(clientId: string, addonKey: AddonKey): Promise<void> {
  const db = await admin();
  const { error } = await db
    .from("client_addons")
    .update({ active: false, deactivated_at: todayInChile() })
    .eq("client_id", clientId)
    .eq("addon_key", addonKey)
    .eq("active", true);
  if (error) {
    console.error("[membresía] no se pudo dar de baja el adicional", clientId, error.message);
    throw new Error("No pudimos dar de baja el adicional. Intenta de nuevo.");
  }
  await cancelOpenPlanCheckoutsWith(clientId, addonKey);
}

/**
 * Cancela los cobros de plan abiertos que incluían la mensualidad de `addonKey`,
 * para que no se pague un link viejo con el monto anterior. El próximo
 * "Renovar" crea uno nuevo sin esa línea.
 */
async function cancelOpenPlanCheckoutsWith(clientId: string, addonKey: AddonKey): Promise<void> {
  const db = await admin();
  const { data, error } = await db
    .from("payments")
    .select("id,items")
    .eq("client_id", clientId)
    .not("plan_key", "is", null)
    .is("proposal_id", null)
    .in("status", [...OPEN_STATUSES]);
  if (error) {
    console.error("[membresía] no se pudieron leer los cobros abiertos", clientId, error.message);
    throw new Error("Dimos de baja el adicional, pero no pudimos actualizar tu próximo pago.");
  }
  const ids = (data ?? [])
    .filter((row) =>
      parsePaymentItems(row.items).some((i) => i.type === "addon" && i.key === addonKey),
    )
    .map((row) => row.id);
  if (ids.length === 0) return;
  const { error: cancelError } = await db
    .from("payments")
    .update({ status: "cancelled" })
    .in("id", ids)
    .in("status", [...OPEN_STATUSES]);
  if (cancelError) {
    console.error(
      "[membresía] no se pudo cancelar el cobro con el adicional",
      ids,
      cancelError.message,
    );
    throw new Error("Dimos de baja el adicional, pero no pudimos actualizar tu próximo pago.");
  }
}
