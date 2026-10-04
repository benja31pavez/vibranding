import { useQuery } from "@tanstack/react-query";
import type { LinkProps } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { addMoney, type MoneyByCurrency } from "@/lib/pricing/plans";
import type { Database } from "@/integrations/supabase/types";

/**
 * Consultas de la pantalla "Hoy". Cada bloque tiene su propia query para que
 * un error en uno no rompa el resto (cada Panel muestra su ErrorState).
 */

/** Meta de MRR de la agencia (CLP, IVA incluido). */
export const MRR_GOAL_CLP = 1_000_000;
/** Ventana de "cobros próximos" en días. */
export const UPCOMING_DAYS = 7;
const CHILE_TZ = "America/Santiago";
const PAGE_SIZE = 1000;
const RECENT_APPROVALS = 5;
const ALERTS_LIMIT = 50;

export const PIPELINE_STAGES = [
  { key: "nuevo", label: "Nuevo" },
  { key: "contactado", label: "Contactado" },
  { key: "respondio", label: "Respondió" },
  { key: "demo", label: "Demo" },
  { key: "propuesta", label: "Propuesta" },
  { key: "ganado", label: "Ganado" },
] as const;

export const APPROVAL_KINDS = [
  { key: "entregable", label: "Entregables" },
  { key: "post_instagram", label: "Posts de Instagram" },
  { key: "propuesta", label: "Propuestas" },
] as const;

type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export const dashboardKeys = {
  all: (userId: string) => ["dashboard-hoy", userId] as const,
  clients: (userId: string) => [...dashboardKeys.all(userId), "clients"] as const,
  mrr: (userId: string) => [...dashboardKeys.all(userId), "mrr"] as const,
  payments: (userId: string) => [...dashboardKeys.all(userId), "open-payments"] as const,
  approvals: (userId: string) => [...dashboardKeys.all(userId), "approvals"] as const,
  alerts: (userId: string) => [...dashboardKeys.all(userId), "campaign-alerts"] as const,
  pipeline: (userId: string) => [...dashboardKeys.all(userId), "pipeline"] as const,
  operations: (userId: string) => [...dashboardKeys.all(userId), "operations"] as const,
};

/** Fecha de hoy (YYYY-MM-DD) en hora de Chile. */
export function chileToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CHILE_TZ }).format(new Date());
}

/** Instante (ISO UTC) de las 00:00 de hoy en Chile, respetando horario de verano. */
export function chileStartOfDayIso(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHILE_TZ,
    timeZoneName: "longOffset",
  }).formatToParts(new Date());
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-03:00";
  const offset = raw === "GMT" ? "+00:00" : raw.replace("GMT", "");
  return new Date(`${chileToday()}T00:00:00${offset}`).toISOString();
}

/** Suma días a una fecha ISO (YYYY-MM-DD) sin depender de la zona local. */
export function addDays(isoDate: string, days: number): string {
  const base = Date.parse(`${isoDate}T12:00:00Z`);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/** Formatea YYYY-MM-DD como "4 oct" (es-CL) sin corrimiento de zona horaria. */
export function formatShortDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Ruta interna sin tipar (p. ej. /approvals o url_hint de la vista). Solo rutas relativas. */
export function internalPath(path: string | null | undefined): LinkProps["to"] | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path as LinkProps["to"];
}

function useUserId(): string {
  const { user } = useAuth();
  return user?.id ?? "";
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Trae todas las filas paginando de a PAGE_SIZE (PostgREST corta en 1000 por defecto). */
async function fetchAllRows<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    fail(error);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) return rows;
  }
}

// ---------------------------------------------------------------- clientes

export interface ClientIndex {
  nameById: ReadonlyMap<string, string>;
  activeCount: number;
}

export function useClientIndex() {
  const userId = useUserId();
  return useQuery({
    queryKey: dashboardKeys.clients(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ClientIndex> => {
      const { data, error } = await supabase.from("clients").select("id,name,status");
      fail(error);
      const rows = data ?? [];
      return {
        nameById: new Map(rows.map((c) => [c.id, c.name])),
        activeCount: rows.filter((c) => c.status === "activo").length,
      };
    },
  });
}

// ---------------------------------------------------------------- MRR

export interface MrrSummary {
  total: number;
  /** Suma de suscripciones activas de clientes activos. */
  fromSubscriptions: number;
  subscriptionClients: number;
  /** client_billing.mrr de clientes activos SIN suscripción activa. */
  fromBilling: number;
  billingClients: number;
}

/**
 * MRR actual en CLP (intervalo de suscripción siempre mensual por CHECK).
 * = Σ subscriptions.amount_clp (status 'activa', cliente con status 'activo')
 * + Σ client_billing.mrr de clientes 'activo' que no tienen suscripción activa.
 * Así un cliente nunca se cuenta dos veces.
 */
export function useMrr() {
  const userId = useUserId();
  return useQuery({
    queryKey: dashboardKeys.mrr(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<MrrSummary> => {
      const [active, subs, billing] = await Promise.all([
        fetchAllRows((from, to) =>
          supabase.from("clients").select("id").eq("status", "activo").order("id").range(from, to),
        ),
        fetchAllRows((from, to) =>
          supabase.from("subscriptions").select("id,client_id,amount_clp").eq("status", "activa").order("id").range(from, to),
        ),
        fetchAllRows((from, to) =>
          supabase.from("client_billing").select("client_id,mrr").order("client_id").range(from, to),
        ),
      ]);
      const activeIds = new Set(active.map((c) => c.id));
      const activeSubs = subs.filter((s) => activeIds.has(s.client_id));
      const subscribed = new Set(activeSubs.map((s) => s.client_id));
      const billed = billing.filter((b) => activeIds.has(b.client_id) && !subscribed.has(b.client_id));
      const fromSubscriptions = activeSubs.reduce((acc, s) => acc + Number(s.amount_clp), 0);
      const fromBilling = billed.reduce((acc, b) => acc + Number(b.mrr), 0);
      return {
        total: fromSubscriptions + fromBilling,
        fromSubscriptions,
        subscriptionClients: subscribed.size,
        fromBilling,
        billingClients: billed.length,
      };
    },
  });
}

// ---------------------------------------------------------------- cobros

export interface OpenPayment {
  id: string;
  client_id: string;
  amount: number;
  currency: string;
  due_date: string | null;
  /** Estado efectivo: 'pending' con vencimiento < hoy (Chile) cuenta como 'overdue'. */
  status: PaymentStatus;
  payment_url: string | null;
  description: string | null;
}

export interface PaymentsSummary {
  /** Pendientes con vencimiento entre hoy y hoy + 7 días (todos, sin truncar). */
  upcoming: OpenPayment[];
  upcomingTotals: MoneyByCurrency;
  /** 'overdue' + 'pending' ya vencidos que el cron aún no marcó (todos, sin truncar). */
  overdue: OpenPayment[];
  overdueTotals: MoneyByCurrency;
  /** Vencidos primero y luego próximos, por fecha. La vista recorta solo esta lista. */
  agenda: OpenPayment[];
}

const PAYMENT_COLUMNS = "id,client_id,amount,currency,due_date,status,payment_url,description";

function totals(rows: readonly OpenPayment[]): MoneyByCurrency {
  return rows.reduce<MoneyByCurrency>((acc, p) => addMoney(acc, p.currency, p.amount), {});
}

function byDueDate(a: OpenPayment, b: OpenPayment): number {
  return (a.due_date ?? "").localeCompare(b.due_date ?? "");
}

export function useOpenPayments() {
  const userId = useUserId();
  return useQuery({
    queryKey: dashboardKeys.payments(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<PaymentsSummary> => {
      const today = chileToday();
      const limit = addDays(today, UPCOMING_DAYS);
      const [overdueRows, upcomingRows] = await Promise.all([
        fetchAllRows((from, to) =>
          supabase
            .from("payments")
            .select(PAYMENT_COLUMNS)
            .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${today})`)
            .order("due_date", { ascending: true, nullsFirst: false })
            .order("id")
            .range(from, to),
        ),
        fetchAllRows((from, to) =>
          supabase
            .from("payments")
            .select(PAYMENT_COLUMNS)
            .eq("status", "pending")
            .gte("due_date", today)
            .lte("due_date", limit)
            .order("due_date", { ascending: true })
            .order("id")
            .range(from, to),
        ),
      ]);
      const overdue = overdueRows
        .map((p): OpenPayment => ({ ...p, amount: Number(p.amount), status: "overdue" }))
        .sort(byDueDate);
      const upcoming = upcomingRows.map((p): OpenPayment => ({ ...p, amount: Number(p.amount) }));
      return {
        upcoming,
        upcomingTotals: totals(upcoming),
        overdue,
        overdueTotals: totals(overdue),
        agenda: [...overdue, ...upcoming],
      };
    },
  });
}

// ---------------------------------------------------------------- aprobaciones

export interface ApprovalItem {
  key: string;
  kind: string;
  title: string;
  client_id: string | null;
  created_at: string | null;
  url_hint: string | null;
}

export interface ApprovalsSummary {
  countByKind: Readonly<Record<string, number>>;
  total: number;
  recent: ApprovalItem[];
}

export function useApprovalsSummary() {
  const userId = useUserId();
  return useQuery({
    queryKey: dashboardKeys.approvals(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ApprovalsSummary> => {
      const countFor = (kind: string) =>
        supabase.from("approval_queue").select("ref_id", { count: "exact", head: true }).eq("kind", kind);
      const [recent, ...counts] = await Promise.all([
        supabase
          .from("approval_queue")
          .select("kind,ref_id,title,client_id,created_at,url_hint")
          .order("created_at", { ascending: false })
          .limit(RECENT_APPROVALS),
        ...APPROVAL_KINDS.map((k) => countFor(k.key)),
      ]);
      fail(recent.error ?? counts.find((c) => c.error)?.error ?? null);
      const countByKind = Object.fromEntries(
        APPROVAL_KINDS.map((k, i) => [k.key, counts[i]?.count ?? 0]),
      );
      return {
        countByKind,
        total: Object.values(countByKind).reduce((a, b) => a + b, 0),
        recent: (recent.data ?? []).map((r, i) => ({
          key: `${r.kind ?? "item"}-${r.ref_id ?? i}`,
          kind: r.kind ?? "",
          title: r.title ?? "Sin título",
          client_id: r.client_id,
          created_at: r.created_at,
          url_hint: r.url_hint,
        })),
      };
    },
  });
}

// ---------------------------------------------------------------- alertas

export interface CampaignAlert {
  id: string;
  client_id: string;
  platform: string;
  kind: string;
  severity: string;
  message: string;
  created_at: string;
}

const SEVERITY_RANK: Readonly<Record<string, number>> = { critical: 0, warning: 1, info: 2 };

function bySeverity(a: CampaignAlert, b: CampaignAlert): number {
  const rank = (s: string) => SEVERITY_RANK[s] ?? 3;
  return rank(a.severity) - rank(b.severity) || b.created_at.localeCompare(a.created_at);
}

export function useOpenCampaignAlerts() {
  const userId = useUserId();
  return useQuery({
    queryKey: dashboardKeys.alerts(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<CampaignAlert[]> => {
      const { data, error } = await supabase
        .from("campaign_alerts")
        .select("id,client_id,platform,kind,severity,message,created_at")
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(ALERTS_LIMIT);
      fail(error);
      return [...(data ?? [])].sort(bySeverity);
    },
  });
}

// ---------------------------------------------------------------- pipeline

export function usePipelineCounts() {
  const userId = useUserId();
  return useQuery({
    queryKey: dashboardKeys.pipeline(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<Readonly<Record<string, number>>> => {
      const results = await Promise.all(
        PIPELINE_STAGES.map((s) =>
          supabase.from("prospects").select("id", { count: "exact", head: true }).eq("estado", s.key),
        ),
      );
      fail(results.find((r) => r.error)?.error ?? null);
      return Object.fromEntries(PIPELINE_STAGES.map((s, i) => [s.key, results[i]?.count ?? 0]));
    },
  });
}
