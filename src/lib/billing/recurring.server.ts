/**
 * Cobro mensual recurrente: por cada suscripción activa con
 * next_charge_date ≤ hoy (Chile) crea el cobro del período y avanza
 * next_charge_date un mes. Seguro de re-ejecutar:
 *  - el índice único payments_subscription_period_uk impide duplicar el mes;
 *  - el avance de fecha es condicional (solo si nadie lo movió antes).
 */
import { addOneMonth, firstDayOfMonth, periodLabel, todayInChile } from "./dates";

/** Tope de meses atrasados que se ponen al día en una sola corrida. */
const MAX_CATCH_UP_MONTHS = 12;
const UNIQUE_VIOLATION = "23505";

const PLAN_LABEL: Readonly<Record<string, string>> = {
  "marca-web": "Marca + Web",
  contenido: "Contenido",
  crecimiento: "Crecimiento",
};

interface SubscriptionRow {
  id: string;
  client_id: string;
  plan_key: string;
  amount_clp: number;
  next_charge_date: string;
  started_at: string | null;
}

export interface SubscriptionChargeResult {
  subscriptionId: string;
  clientId: string;
  created: string[];
  skipped: string[];
  nextChargeDate: string | null;
  error?: string;
}

export interface MonthlyChargeSummary {
  today: string;
  subscriptions: number;
  paymentsCreated: number;
  failed: number;
  results: SubscriptionChargeResult[];
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function billingDays(clientIds: string[]): Promise<Map<string, number>> {
  if (clientIds.length === 0) return new Map();
  const db = await admin();
  const { data, error } = await db
    .from("client_billing")
    .select("client_id,billing_day")
    .in("client_id", clientIds);
  if (error) throw new Error(`No se pudo leer client_billing: ${error.message}`);
  return new Map(
    (data ?? [])
      .filter((r) => typeof r.billing_day === "number")
      .map((r) => [r.client_id, r.billing_day as number]),
  );
}

function anchorDayOf(sub: SubscriptionRow, billingDay: number | undefined): number {
  if (billingDay) return billingDay;
  const fromStart = sub.started_at ? Number(sub.started_at.slice(8, 10)) : NaN;
  return Number.isFinite(fromStart) && fromStart > 0
    ? fromStart
    : Number(sub.next_charge_date.slice(8, 10));
}

/** Inserta el cobro del período; false si ya existía (índice único). */
async function insertPeriodPayment(sub: SubscriptionRow, chargeDate: string): Promise<boolean> {
  const db = await admin();
  const period = firstDayOfMonth(chargeDate);
  const plan = PLAN_LABEL[sub.plan_key] ?? sub.plan_key;
  const { error } = await db.from("payments").insert({
    client_id: sub.client_id,
    subscription_id: sub.id,
    kind: "mensual",
    period,
    amount: sub.amount_clp,
    currency: "CLP",
    status: "pending",
    due_date: chargeDate,
    description: `Plan ${plan} · ${periodLabel(period)}`,
  });
  if (!error) return true;
  if (error.code === UNIQUE_VIOLATION) return false;
  throw new Error(`No se pudo crear el cobro de ${period}: ${error.message}`);
}

async function chargeSubscription(
  sub: SubscriptionRow,
  today: string,
  billingDay: number | undefined,
): Promise<SubscriptionChargeResult> {
  const db = await admin();
  const anchor = anchorDayOf(sub, billingDay);
  const result: SubscriptionChargeResult = {
    subscriptionId: sub.id,
    clientId: sub.client_id,
    created: [],
    skipped: [],
    nextChargeDate: sub.next_charge_date,
  };

  let current = sub.next_charge_date;
  for (let i = 0; i < MAX_CATCH_UP_MONTHS && current <= today; i++) {
    const period = firstDayOfMonth(current);
    const inserted = await insertPeriodPayment(sub, current);
    (inserted ? result.created : result.skipped).push(period);

    const next = addOneMonth(current, anchor);
    const { data, error } = await db
      .from("subscriptions")
      .update({ next_charge_date: next })
      .eq("id", sub.id)
      .eq("status", "activa")
      .eq("next_charge_date", current)
      .select("id");
    if (error) throw new Error(`No se pudo avanzar next_charge_date: ${error.message}`);
    if (!data || data.length === 0) break; // otra corrida ya la avanzó o cambió de estado
    current = next;
    result.nextChargeDate = next;
  }
  return result;
}

export async function runMonthlyCharges(
  today: string = todayInChile(),
): Promise<MonthlyChargeSummary> {
  const db = await admin();
  const { data, error } = await db
    .from("subscriptions")
    .select("id,client_id,plan_key,amount_clp,next_charge_date,started_at")
    .eq("status", "activa")
    .not("next_charge_date", "is", null)
    .lte("next_charge_date", today)
    .order("next_charge_date", { ascending: true });
  if (error) throw new Error(`No se pudieron leer las suscripciones: ${error.message}`);

  const subs = (data ?? []) as SubscriptionRow[];
  const days = await billingDays([...new Set(subs.map((s) => s.client_id))]);

  const results: SubscriptionChargeResult[] = [];
  for (const sub of subs) {
    try {
      results.push(await chargeSubscription(sub, today, days.get(sub.client_id)));
    } catch (e) {
      const message = (e as Error).message;
      console.error("[billing monthly] suscripción falló", sub.id, message);
      results.push({
        subscriptionId: sub.id,
        clientId: sub.client_id,
        created: [],
        skipped: [],
        nextChargeDate: sub.next_charge_date,
        error: message,
      });
    }
  }

  return {
    today,
    subscriptions: subs.length,
    paymentsCreated: results.reduce((n, r) => n + r.created.length, 0),
    failed: results.filter((r) => r.error).length,
    results,
  };
}
