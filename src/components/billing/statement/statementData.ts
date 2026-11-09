/**
 * Datos del estado de cuenta de un cliente (Facturación): pagos y permisos.
 * El plan vigente sale de la membresía (lib/billing/membership.functions).
 * Nunca lee el MRR ni el token de onboarding: esta pantalla también la verá el
 * cliente.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resolveUserKind } from "@/lib/auth/userKind";
import { daysUntilDue } from "@/lib/billing/reminders";
import { isPastDue } from "@/lib/billing/openPayments";
import { EMPTY_CLP_TOTALS, addClp, type ClpTotals } from "@/lib/pricing/plans";

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
  plan_key: string | null;
  period_start: string | null;
  period_end: string | null;
  payment_url: string | null;
  document_path: string | null;
  document_type: string | null;
  /** "flow" cuando se pagó por la plataforma; null en registros manuales/antiguos. */
  provider: string | null;
  created_at: string;
}

/** Sin flow_token ni provider_ref: no hacen falta en pantalla. */
const PAYMENT_COLUMNS =
  "id,client_id,description,amount,currency,status,due_date,paid_at,period,plan_key,period_start,period_end,payment_url,document_path,document_type,provider,created_at";

export const statementKeys = {
  all: (userId: string, clientId: string) => ["statement", userId, clientId] as const,
  payments: (userId: string, clientId: string) =>
    ["statement", userId, clientId, "payments"] as const,
  access: (userId: string, clientId: string) => ["statement", userId, clientId, "access"] as const,
};

function useUserId(): string {
  const { user } = useAuth();
  return user?.id ?? "";
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

/** Recarga los pagos de este cliente (tras crear, editar o subir). */
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

/** Abiertos primero (vencidos y por vencer, por fecha), luego el historial. */
export function sortForStatement(payments: readonly StatementPayment[]): StatementPayment[] {
  const open = payments
    .filter(isOpen)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const rest = payments.filter((p) => !isOpen(p));
  return [...open, ...rest];
}
