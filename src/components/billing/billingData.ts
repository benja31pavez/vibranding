import { supabase } from "@/integrations/supabase/client";
import { addMoney, type MoneyByCurrency } from "@/lib/pricing/plans";
import { firstDayOfMonth } from "@/lib/billing/dates";
import { fetchAllRows } from "@/lib/db/fetchAllRows";
import { isDueSoon, isPastDue } from "@/lib/billing/openPayments";

export type BillingStatus = "pending" | "paid" | "overdue" | "cancelled";
export type BillingFilter = "vencidos" | "por_vencer" | "mes" | "todos";

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
}

const PAYMENT_COLUMNS =
  "id,client_id,description,amount,currency,status,due_date,paid_at,period,payment_url,clients(name)";

/**
 * Todos los cobros, paginados de a 1000: así "Vencidos", "Por vencer" y los
 * totales nunca se truncan. El MRR viene de `useMrr` (mismo cálculo que "Hoy").
 */
export async function loadBillingData(): Promise<BillingData> {
  const payments = await fetchAllRows((from, to) =>
    supabase
      .from("payments")
      .select(PAYMENT_COLUMNS)
      .order("due_date", { ascending: false, nullsFirst: false })
      .order("id")
      .range(from, to),
  );
  const rows: BillingRow[] = payments.map((p) => {
    const { clients, ...rest } = p as typeof p & { clients: { name: string } | null };
    return { ...rest, amount: Number(rest.amount), client_name: clients?.name ?? "—" };
  });
  return { rows };
}

export function isOverdue(row: BillingRow, today: string): boolean {
  return isPastDue(row, today);
}

function inMonth(date: string | null, month: string): boolean {
  return Boolean(date) && firstDayOfMonth(date as string) === month;
}

export function filterRows(rows: readonly BillingRow[], filter: BillingFilter, today: string) {
  const month = firstDayOfMonth(today);
  if (filter === "vencidos") return rows.filter((r) => isOverdue(r, today));
  if (filter === "por_vencer") {
    return rows
      .filter((r) => isDueSoon(r, today))
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  }
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
