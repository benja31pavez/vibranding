import { useQuery } from "@tanstack/react-query";
import type { LinkProps } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { EMPTY_CLP_TOTALS, addClp, type ClpTotals } from "@/lib/pricing/plans";
import type { Database, Json } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/db/fetchAllRows";
import { UPCOMING_DAYS, addIsoDays, upcomingUntil } from "@/lib/billing/openPayments";

export { UPCOMING_DAYS };
export { useMrr, type MrrSummary } from "@/lib/billing/mrr";

/**
 * Consultas de la pantalla "Hoy". Cada bloque tiene su propia query para que
 * un error en uno no rompa el resto (cada Panel muestra su ErrorState).
 */

const CHILE_TZ = "America/Santiago";
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
export const addDays = addIsoDays;

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
  upcomingTotals: ClpTotals;
  /** 'overdue' + 'pending' ya vencidos que el cron aún no marcó (todos, sin truncar). */
  overdue: OpenPayment[];
  overdueTotals: ClpTotals;
  /** Vencidos primero y luego próximos, por fecha. La vista recorta solo esta lista. */
  agenda: OpenPayment[];
}

const PAYMENT_COLUMNS = "id,client_id,amount,currency,due_date,status,payment_url,description";

function totals(rows: readonly OpenPayment[]): ClpTotals {
  return rows.reduce<ClpTotals>((acc, p) => addClp(acc, p.currency, p.amount), EMPTY_CLP_TOTALS);
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
      const limit = upcomingUntil(today);
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
        supabase
          .from("approval_queue")
          .select("ref_id", { count: "exact", head: true })
          .eq("kind", kind);
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
  data: Json;
}

const SEVERITY_RANK: Readonly<Record<string, number>> = { critical: 0, warning: 1, info: 2 };

function bySeverity(a: CampaignAlert, b: CampaignAlert): number {
  const rank = (s: string) => SEVERITY_RANK[s] ?? 3;
  return rank(a.severity) - rank(b.severity) || b.created_at.localeCompare(a.created_at);
}

export interface CampaignAlertsSummary {
  /** Abiertas, de más a menos severa (máx. ALERTS_LIMIT). */
  open: CampaignAlert[];
  /** Filas históricas (abiertas o resueltas). 0 = nada genera alertas todavía. */
  everCount: number;
  /** Clientes (con alertas abiertas) que el usuario puede editar: solo ellos ven "Marcar como resuelta". */
  editableClientIds: ReadonlySet<string>;
}

/** can_edit_client por cada cliente con alertas abiertas (pocos: tope ALERTS_LIMIT). */
async function editableClients(clientIds: string[]): Promise<Set<string>> {
  const checks = await Promise.all(
    clientIds.map(async (id) => {
      const { data, error } = await supabase.rpc("can_edit_client", { _client_id: id });
      // Si la función falla, se oculta el botón: el servidor igual valida al resolver.
      return !error && Boolean(data) ? id : null;
    }),
  );
  return new Set(checks.filter((id): id is string => id !== null));
}

export function useOpenCampaignAlerts() {
  const userId = useUserId();
  return useQuery({
    queryKey: dashboardKeys.alerts(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<CampaignAlertsSummary> => {
      const [open, ever] = await Promise.all([
        supabase
          .from("campaign_alerts")
          .select("id,client_id,platform,kind,severity,message,created_at,data")
          .is("resolved_at", null)
          .order("created_at", { ascending: false })
          .limit(ALERTS_LIMIT),
        supabase.from("campaign_alerts").select("id", { count: "exact", head: true }),
      ]);
      fail(open.error ?? ever.error);
      const rows = open.data ?? [];
      const editableClientIds = await editableClients([...new Set(rows.map((a) => a.client_id))]);
      return { open: [...rows].sort(bySeverity), everCount: ever.count ?? 0, editableClientIds };
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
          supabase
            .from("prospects")
            .select("id", { count: "exact", head: true })
            .eq("estado", s.key),
        ),
      );
      fail(results.find((r) => r.error)?.error ?? null);
      return Object.fromEntries(PIPELINE_STAGES.map((s, i) => [s.key, results[i]?.count ?? 0]));
    },
  });
}
