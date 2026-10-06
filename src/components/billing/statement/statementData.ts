/**
 * Datos del estado de cuenta de un cliente (Facturación): plan, pagos y
 * permisos. Nunca lee el MRR ni el token de onboarding: esta pantalla también
 * la verá el cliente.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resolveUserKind } from "@/lib/auth/userKind";
import { addOneMonth } from "@/lib/billing/dates";
import { daysUntilDue } from "@/lib/billing/reminders";
import { isPastDue } from "@/lib/billing/openPayments";
import {
  EMPTY_CLP_TOTALS,
  addClp,
  findPlan,
  planTotal,
  type ClpTotals,
  type Plan,
} from "@/lib/pricing/plans";
import { netOfTotal } from "@/lib/pricing/iva";

export type PaymentStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface StatementPayment {
  id: string;
  client_id: string;
  description: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  due_date: string | null;
  paid_at: string | null;
  period: string | null;
  payment_url: string | null;
  document_path: string | null;
  document_type: string | null;
  created_at: string;
}

/** Sin flow_token ni provider_ref: no hacen falta en pantalla. */
const PAYMENT_COLUMNS =
  "id,client_id,description,amount,currency,status,due_date,paid_at,period,payment_url,document_path,document_type,created_at";

interface Subscription {
  plan_key: string;
  amount_clp: number;
  interval: string;
  min_months: number;
  started_at: string | null;
  next_charge_date: string | null;
}

export interface StatementPlanData {
  planKey: string | null;
  billingDay: number | null;
  clientSince: string | null;
  subscription: Subscription | null;
}

export const statementKeys = {
  all: (userId: string, clientId: string) => ["statement", userId, clientId] as const,
  plan: (userId: string, clientId: string) => ["statement", userId, clientId, "plan"] as const,
  payments: (userId: string, clientId: string) =>
    ["statement", userId, clientId, "payments"] as const,
  access: (userId: string, clientId: string) => ["statement", userId, clientId, "access"] as const,
};

function useUserId(): string {
  const { user } = useAuth();
  return user?.id ?? "";
}

export function usePlanData(clientId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: statementKeys.plan(userId, clientId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<StatementPlanData> => {
      const [clientRes, billingRes, subRes] = await Promise.all([
        supabase.from("clients").select("started_at").eq("id", clientId).maybeSingle(),
        // Solo plan y día de cobro (nunca mrr). Para un usuario cliente la RLS no
        // devuelve filas y se usa la suscripción.
        supabase
          .from("client_billing")
          .select("plan_key,billing_day")
          .eq("client_id", clientId)
          .maybeSingle(),
        supabase
          .from("subscriptions")
          .select("plan_key,amount_clp,interval,min_months,started_at,next_charge_date")
          .eq("client_id", clientId)
          .eq("status", "activa")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (subRes.error) throw new Error(subRes.error.message);
      if (billingRes.error) console.warn("[facturación] client_billing", billingRes.error.message);
      if (clientRes.error) console.warn("[facturación] clients", clientRes.error.message);
      const sub = subRes.data as Subscription | null;
      return {
        planKey: sub?.plan_key ?? billingRes.data?.plan_key ?? null,
        billingDay: billingRes.data?.billing_day ?? null,
        clientSince: clientRes.data?.started_at ?? sub?.started_at ?? null,
        subscription: sub,
      };
    },
  });
}

export function usePayments(clientId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: statementKeys.payments(userId, clientId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<StatementPayment[]> => {
      const { data, error } = await supabase
        .from("payments")
        .select(PAYMENT_COLUMNS)
        .eq("client_id", clientId)
        .order("due_date", { ascending: false, nullsFirst: true })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((p) => ({ ...p, amount: Number(p.amount) }) as StatementPayment);
    },
  });
}

export interface StatementAccess {
  /** Miembro de la agencia con permiso de edición (owner/admin/agent). */
  canEdit: boolean;
  /** owner/admin: puede cambiar estados (set_payment_status). */
  canManage: boolean;
}

const NO_ACCESS: StatementAccess = { canEdit: false, canManage: false };

/**
 * Permisos de agencia sobre este cliente. Falla CERRADO: un usuario cliente,
 * un error o una respuesta dudosa dejan todo en false (solo lectura).
 */
export function useStatementAccess(clientId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: statementKeys.access(userId, clientId),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<StatementAccess> => {
      const kind = await resolveUserKind(userId).catch(() => null);
      if (kind !== "agency") return NO_ACCESS;
      const [edit, manage] = await Promise.all([
        supabase.rpc("can_edit_client", { _client_id: clientId }),
        supabase.rpc("manages_client", { _client_id: clientId }),
      ]);
      const canEdit = !edit.error && edit.data === true;
      return { canEdit, canManage: canEdit && !manage.error && manage.data === true };
    },
  });
}

/** Recarga plan y pagos de este cliente (tras crear, editar o subir). */
export function useReloadStatement(clientId: string) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return () => queryClient.invalidateQueries({ queryKey: statementKeys.all(userId, clientId) });
}

// ---------------------------------------------------------------- derivados

export function isOpen(p: Pick<StatementPayment, "status">): boolean {
  return p.status === "pending" || p.status === "overdue";
}

/** Estado que ve el cliente: un pendiente con fecha pasada ya es "Vencido". */
export function displayStatus(p: StatementPayment, today: string): PaymentStatus {
  return isPastDue(p, today) ? "overdue" : p.status;
}

const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** "Vence en 3 días" / "Vence hoy" / "Venció hace 2 días" (solo cobros abiertos). */
export function relativeDue(p: StatementPayment, today: string): string | null {
  if (!isOpen(p)) return null;
  const diff = daysUntilDue(p.due_date, today);
  if (diff === null) return null;
  if (diff < 0) return `Venció hace ${days(-diff)}`;
  if (diff === 0) return "Vence hoy";
  if (diff === 1) return "Vence mañana";
  return `Vence en ${days(diff)}`;
}

export interface StatementSummary {
  paidThisYear: ClpTotals;
  toPay: ClpTotals;
  overdue: ClpTotals;
  overdueCount: number;
  openCount: number;
}

export function summarize(payments: readonly StatementPayment[], today: string): StatementSummary {
  const year = today.slice(0, 4);
  return payments.reduce<StatementSummary>(
    (acc, p) => {
      if (p.status === "paid" && (p.paid_at ?? p.due_date ?? "").startsWith(year)) {
        return { ...acc, paidThisYear: addClp(acc.paidThisYear, p.currency, p.amount) };
      }
      if (!isOpen(p)) return acc;
      if (isPastDue(p, today)) {
        return {
          ...acc,
          overdue: addClp(acc.overdue, p.currency, p.amount),
          overdueCount: acc.overdueCount + 1,
          openCount: acc.openCount + 1,
        };
      }
      return {
        ...acc,
        toPay: addClp(acc.toPay, p.currency, p.amount),
        openCount: acc.openCount + 1,
      };
    },
    {
      paidThisYear: EMPTY_CLP_TOTALS,
      toPay: EMPTY_CLP_TOTALS,
      overdue: EMPTY_CLP_TOTALS,
      overdueCount: 0,
      openCount: 0,
    },
  );
}

export type AccountStanding = "al_dia" | "por_pagar" | "vencido";

export function accountStanding(summary: StatementSummary): AccountStanding {
  if (summary.overdueCount > 0) return "vencido";
  if (summary.openCount > 0) return "por_pagar";
  return "al_dia";
}

/** Abiertos primero (vencidos y por vencer, por fecha), luego el historial. */
export function sortForStatement(payments: readonly StatementPayment[]): StatementPayment[] {
  const open = payments
    .filter(isOpen)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const rest = payments.filter((p) => !isOpen(p));
  return [...open, ...rest];
}

export interface PlanView {
  plan: Plan | null;
  label: string | null;
  /** Total por período con IVA y su neto. */
  total: number | null;
  net: number | null;
  monthly: boolean;
  clientSince: string | null;
  /** Permanencia mínima vigente: meses y fecha de término (YYYY-MM-DD). */
  commitment: { months: number; until: string } | null;
}

/** Suma meses anclado al día original (31-ene + 1 → 28/29-feb, + 2 → 31-mar). */
function addMonths(iso: string, months: number): string {
  const anchorDay = Number(iso.slice(8, 10));
  let date = iso.slice(0, 10);
  for (let i = 0; i < months; i += 1) date = addOneMonth(date, anchorDay);
  return date;
}

export function planView(data: StatementPlanData, today: string): PlanView {
  const plan = findPlan(data.planKey);
  const sub = data.subscription;
  const total = sub ? sub.amount_clp : plan ? planTotal(plan) : null;
  const monthly = sub ? sub.interval !== "one_time" : plan?.billing === "monthly";
  const months = sub?.min_months || (monthly ? (plan?.minMonths ?? 0) : 0);
  const start = sub?.started_at ?? data.clientSince;
  const until = months > 0 && start ? addMonths(start, months) : null;
  return {
    plan,
    label: plan?.label ?? (data.planKey ? data.planKey : null),
    total,
    net: total !== null ? netOfTotal(total) : null,
    monthly: Boolean(monthly),
    clientSince: data.clientSince,
    commitment: until && until >= today ? { months, until } : null,
  };
}

/** Próximo día de cobro a partir de hoy, según el día del mes acordado. */
function nextBillingDate(billingDay: number, today: string): string {
  const thisMonth = `${today.slice(0, 8)}${String(billingDay).padStart(2, "0")}`;
  return thisMonth >= today ? thisMonth : addOneMonth(thisMonth, billingDay);
}

export interface NextCharge {
  date: string;
  amount: number;
}

/**
 * Próximo cobro: el cobro pendiente más cercano que aún no vence; si no hay,
 * la fecha de la suscripción o la del día de cobro con el total del plan.
 */
export function nextCharge(
  payments: readonly StatementPayment[],
  data: StatementPlanData,
  view: PlanView,
  today: string,
): NextCharge | null {
  const upcoming = payments
    .filter((p) => p.status === "pending" && p.due_date && p.due_date.slice(0, 10) >= today)
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))[0];
  if (upcoming?.due_date) return { date: upcoming.due_date.slice(0, 10), amount: upcoming.amount };
  if (!view.monthly || view.total === null) return null;
  const subDate = data.subscription?.next_charge_date;
  if (subDate && subDate >= today) return { date: subDate.slice(0, 10), amount: view.total };
  if (data.billingDay) return { date: nextBillingDate(data.billingDay, today), amount: view.total };
  return null;
}
