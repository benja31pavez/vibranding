import { supabase } from "@/integrations/supabase/client";
import { addMoney, type MoneyByCurrency } from "@/lib/pricing/plans";
import { firstDayOfMonth } from "@/lib/billing/dates";

export type BillingStatus = "pending" | "paid" | "overdue" | "cancelled";
export type BillingFilter = "vencidos" | "mes" | "todos";

export interface BillingRow {
  id: string;
  client_id: string;
  client_name: string;
  description: string | null;
  amount: number;
  currency: string;
  status: BillingStatus;
  due_date: string | null;
  paid_at: string | null;
  period: string | null;
  payment_url: string | null;
}

export interface BillingData {
  rows: BillingRow[];
  mrr: number;
}

/** Límite de seguridad: la vista global no pagina todavía. */
const MAX_ROWS = 500;

export async function loadBillingData(): Promise<BillingData> {
  const [payments, billing] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id,client_id,description,amount,currency,status,due_date,paid_at,period,payment_url,clients(name)",
      )
      .order("due_date", { ascending: false, nullsFirst: false })
      .limit(MAX_ROWS),
    supabase
      .from("client_billing")
      .select("mrr,clients!inner(status)")
      .eq("clients.status", "activo"),
  ]);
  if (payments.error) throw new Error(payments.error.message);
  if (billing.error) throw new Error(billing.error.message);

  const rows: BillingRow[] = (payments.data ?? []).map((p) => {
    const { clients, ...rest } = p as typeof p & { clients: { name: string } | null };
    return { ...rest, amount: Number(rest.amount), client_name: clients?.name ?? "—" };
  });
  const mrr = (billing.data ?? []).reduce((acc, r) => acc + Number(r.mrr ?? 0), 0);
  return { rows, mrr };
}

export function isOverdue(row: BillingRow, today: string): boolean {
  if (row.status === "overdue") return true;
  return row.status === "pending" && Boolean(row.due_date) && (row.due_date as string) < today;
}

function inMonth(date: string | null, month: string): boolean {
  return Boolean(date) && firstDayOfMonth(date as string) === month;
}

export function filterRows(rows: readonly BillingRow[], filter: BillingFilter, today: string) {
  const month = firstDayOfMonth(today);
  if (filter === "vencidos") return rows.filter((r) => isOverdue(r, today));
  if (filter === "mes") {
    return rows.filter((r) => inMonth(r.due_date, month) || inMonth(r.period, month));
  }
  return [...rows];
}

export interface BillingTotals {
  collectedThisMonth: MoneyByCurrency;
  receivable: MoneyByCurrency;
}

export function computeTotals(rows: readonly BillingRow[], today: string): BillingTotals {
  const month = firstDayOfMonth(today);
  return rows.reduce<BillingTotals>(
    (acc, r) => {
      if (r.status === "paid" && inMonth(r.paid_at, month)) {
        return {
          ...acc,
          collectedThisMonth: addMoney(acc.collectedThisMonth, r.currency, r.amount),
        };
      }
      if (r.status === "pending" || r.status === "overdue") {
        return { ...acc, receivable: addMoney(acc.receivable, r.currency, r.amount) };
      }
      return acc;
    },
    { collectedThisMonth: {}, receivable: {} },
  );
}
