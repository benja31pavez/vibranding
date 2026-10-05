import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { netOfTotal } from "@/lib/pricing/iva";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchAllRows } from "@/lib/db/fetchAllRows";
import { addDaysYmd, chileDate, chileToday } from "@/lib/dates/chile";
import { chileMidnightUtc } from "@/lib/reports/period";
import {
  computeFunnel,
  computeSources,
  EXCLUDED_STATE,
  type FunnelSummary,
  type SourceRow,
} from "@/lib/growth/funnel";
import { lastMonths, monthlyTrend, TREND_MONTHS, type TrendPoint } from "@/lib/growth/goal";

/** Rangos del embudo (días hacia atrás desde hoy, hora de Chile). */
export const FUNNEL_RANGES = [
  { days: 30, label: "Últimos 30 días" },
  { days: 90, label: "Últimos 90 días" },
] as const;
export type FunnelRangeDays = (typeof FUNNEL_RANGES)[number]["days"];
export const DEFAULT_FUNNEL_DAYS: FunnelRangeDays = 30;

const PENDING_STATUSES = ["enviada", "vista"] as const;
const PENDING_LIMIT = 50;
/** Se piden más filas que las que se muestran porque las de prospectos en baja se descartan después. */
const PENDING_FETCH = 150;

function sinceUtc(days: number): string {
  return chileMidnightUtc(addDaysYmd(chileToday(), -(days - 1)));
}

export interface FunnelData {
  funnel: FunnelSummary;
  sources: SourceRow[];
}

async function loadFunnel(days: FunnelRangeDays): Promise<FunnelData> {
  const from = sinceUtc(days);
  const [prospects, proposals] = await Promise.all([
    fetchAllRows((a, b) =>
      supabase
        .from("prospects")
        .select("id,estado,fuente,created_at,ultimo_contacto,client_id")
        .gte("created_at", from)
        .neq("estado", EXCLUDED_STATE)
        .order("id")
        .range(a, b),
    ),
    // Una propuesta siempre es posterior a su prospecto: basta con las creadas en el período.
    fetchAllRows((a, b) =>
      supabase
        .from("proposals")
        .select("id,prospect_id,status,sent_at,accepted_at")
        .not("prospect_id", "is", null)
        .gte("created_at", from)
        .order("id")
        .range(a, b),
    ),
  ]);
  return {
    funnel: computeFunnel(prospects, proposals),
    sources: computeSources(prospects, proposals),
  };
}

export function useFunnel(days: FunnelRangeDays) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: ["reports", "growth", "funnel", userId, days],
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
    queryFn: () => loadFunnel(days),
  });
}

async function loadRecurringTrend(): Promise<TrendPoint[]> {
  const months = lastMonths(chileToday().slice(0, 7), TREND_MONTHS);
  const from = chileMidnightUtc(`${months[0]}-01`);
  const rows = await fetchAllRows((a, b) =>
    supabase
      .from("payments")
      .select("id,amount,currency,paid_at")
      .eq("status", "paid")
      // Recurrente = kind "mensual" o ligado a una suscripción. kind NULL sin suscripción
      // son cobros antiguos/manuales de tipo desconocido: se excluyen (ver monthlyTrend).
      .or("kind.eq.mensual,subscription_id.not.is.null")
      .gte("paid_at", from)
      .order("id")
      .range(a, b),
  );
  const payments = rows.flatMap((p) =>
    p.paid_at
      ? [
          {
            // Cobros guardados con IVA → neto, para compararlo con el MRR (neto).
            amount: netOfTotal(Number(p.amount)),
            currency: p.currency,
            month: chileDate(new Date(p.paid_at)).slice(0, 7),
          },
        ]
      : [],
  );
  return monthlyTrend(payments, months);
}

export function useRecurringTrend() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: ["reports", "growth", "trend", userId],
    enabled: Boolean(userId),
    queryFn: loadRecurringTrend,
  });
}

export interface PendingProposal {
  id: string;
  title: string | null;
  amount_clp: number;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  expires_at: string | null;
  recipient: string;
  /** Prospecto en "frío": se lista, pero no se marca para seguimiento. */
  cold: boolean;
  /** Ya pasó expires_at aunque el estado siga "enviada"/"vista". */
  expired: boolean;
}

export interface PendingProposals {
  items: PendingProposal[];
  /** true si había más de PENDING_LIMIT y se muestran solo las más antiguas. */
  truncated: boolean;
  limit: number;
}

async function loadPendingProposals(): Promise<PendingProposals> {
  const { data, error } = await supabase
    .from("proposals")
    .select(
      "id,title,amount_clp,status,sent_at,viewed_at,expires_at,prospect:prospects(nombre,estado),client:clients(name)",
    )
    .in("status", [...PENDING_STATUSES])
    .order("sent_at", { ascending: true, nullsFirst: false })
    .limit(PENDING_FETCH);
  if (error) throw new Error(error.message);
  const now = Date.now();
  const rows = (data ?? []).filter((p) => p.prospect?.estado !== EXCLUDED_STATE);
  const items = rows.slice(0, PENDING_LIMIT).map((p) => ({
    id: p.id,
    title: p.title,
    amount_clp: p.amount_clp,
    status: p.status,
    sent_at: p.sent_at,
    viewed_at: p.viewed_at,
    expires_at: p.expires_at,
    recipient: p.prospect?.nombre ?? p.client?.name ?? "Sin destinatario",
    cold: p.prospect?.estado === "frio",
    expired: p.expires_at ? Date.parse(p.expires_at) < now : false,
  }));
  return { items, truncated: rows.length > PENDING_LIMIT, limit: PENDING_LIMIT };
}

export function usePendingProposals() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: ["reports", "growth", "pending-proposals", userId],
    enabled: Boolean(userId),
    queryFn: loadPendingProposals,
  });
}
