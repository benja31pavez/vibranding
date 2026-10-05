import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchAllRows } from "@/lib/db/fetchAllRows";
import { chileToday } from "@/lib/dates/chile";
import {
  SCORED_CLIENT_STATUSES,
  activitySince,
  closedPeriod,
  computeClientHealth,
  type ClientHealth,
  type HealthActivityInput,
  type HealthSources,
} from "@/lib/health";

/**
 * Datos de "Salud del cliente". Lee con la sesión del usuario (RLS) solo las
 * columnas necesarias, con topes por consulta, y aplica las reglas puras de
 * src/lib/health. Con `clientId` acota todo a ese cliente (ficha).
 */

const REFRESH_MS = 10 * 60 * 1000;
/** Tope por consulta: una agencia chica no se acerca; evita respuestas sin límite. */
const ROW_LIMIT = 1000;
const APPROVAL_KINDS = ["entregable", "post_instagram"];

export const healthKeys = {
  all: (userId: string) => ["client-health", userId] as const,
  scope: (userId: string, clientId: string | null) =>
    ["client-health", userId, clientId ?? "all"] as const,
};

type Result<T> = { data: T[] | null; error: { message: string } | null };

async function rows<T>(query: PromiseLike<Result<T>>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Aplica `.eq(column, clientId)` solo si hay cliente (ficha). */
function scoped<Q extends { eq: (column: string, value: string) => Q }>(
  query: Q,
  clientId: string | null,
  column = "client_id",
): Q {
  return clientId ? query.eq(column, clientId) : query;
}

async function loadActivity(
  clientId: string | null,
  sinceYmd: string,
): Promise<HealthActivityInput[]> {
  const since = `${sinceYmd}T00:00:00Z`;
  const [comments, approvals, paid, reports, deliverables] = await Promise.all([
    rows(
      scoped(supabase.from("deliverable_comments").select("client_id,created_at"), clientId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
    ),
    rows(
      scoped(supabase.from("instagram_posts").select("client_id,approved_at"), clientId)
        .gte("approved_at", since)
        .order("approved_at", { ascending: false })
        .limit(ROW_LIMIT),
    ),
    rows(
      scoped(supabase.from("payments").select("client_id,paid_at"), clientId)
        .gte("paid_at", since)
        .order("paid_at", { ascending: false })
        .limit(ROW_LIMIT),
    ),
    rows(
      scoped(supabase.from("monthly_reports").select("client_id,sent_at"), clientId)
        .gte("sent_at", since)
        .order("sent_at", { ascending: false })
        .limit(ROW_LIMIT),
    ),
    rows(
      scoped(supabase.from("deliverables").select("client_id,updated_at"), clientId)
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(ROW_LIMIT),
    ),
  ]);
  return [
    ...comments.map((r) => ({ client_id: r.client_id, at: r.created_at })),
    ...approvals.map((r) => ({ client_id: r.client_id, at: r.approved_at })),
    ...paid.map((r) => ({ client_id: r.client_id, at: r.paid_at })),
    ...reports.map((r) => ({ client_id: r.client_id, at: r.sent_at })),
    ...deliverables.map((r) => ({ client_id: r.client_id, at: r.updated_at })),
  ];
}

export async function loadHealthSources(
  clientId: string | null,
  today: string,
): Promise<HealthSources> {
  const statuses = [...SCORED_CLIENT_STATUSES];
  const [
    clients,
    payments,
    approvals,
    igChanges,
    commentChanges,
    alerts,
    reports,
    subscriptions,
    billing,
    intakes,
    activity,
  ] = await Promise.all([
    clientId
      ? rows(
          supabase
            .from("clients")
            .select("id,name,status,created_at,started_at")
            .eq("id", clientId)
            .in("status", statuses),
        )
      : fetchAllRows((from, to) =>
          supabase
            .from("clients")
            .select("id,name,status,created_at,started_at")
            .in("status", statuses)
            .order("id")
            .range(from, to),
        ),
    rows(
      scoped(supabase.from("payments").select("client_id,status,due_date"), clientId)
        .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${today})`)
        .limit(ROW_LIMIT),
    ),
    rows(
      scoped(supabase.from("approval_queue").select("client_id,created_at"), clientId)
        .in("kind", APPROVAL_KINDS)
        .order("created_at", { ascending: true })
        .limit(ROW_LIMIT),
    ),
    rows(
      scoped(supabase.from("instagram_posts").select("client_id,updated_at"), clientId)
        .eq("approval_status", "cambios")
        .is("archived_at", null)
        .limit(ROW_LIMIT),
    ),
    rows(
      scoped(supabase.from("deliverable_comments").select("client_id,created_at"), clientId)
        .eq("kind", "change_request")
        .eq("read_by_agency", false)
        .limit(ROW_LIMIT),
    ),
    rows(
      scoped(supabase.from("campaign_alerts").select("client_id,severity,created_at"), clientId)
        .is("resolved_at", null)
        .limit(ROW_LIMIT),
    ),
    rows(
      scoped(supabase.from("monthly_reports").select("client_id,period,sent_at"), clientId)
        .eq("period", closedPeriod(today))
        .limit(ROW_LIMIT),
    ),
    rows(
      scoped(
        supabase.from("subscriptions").select("client_id,status,started_at,min_months"),
        clientId,
      )
        .eq("status", "activa")
        .limit(ROW_LIMIT),
    ),
    rows(
      scoped(supabase.from("client_billing").select("client_id"), clientId)
        .not("onboarding_token", "is", null)
        .limit(ROW_LIMIT),
    ),
    rows(scoped(supabase.from("client_intake").select("client_id"), clientId).limit(ROW_LIMIT)),
    loadActivity(clientId, activitySince(today)),
  ]);

  return {
    clients,
    payments,
    approvals,
    changeRequests: [
      ...igChanges.map((r) => ({ client_id: r.client_id, created_at: r.updated_at })),
      ...commentChanges,
    ],
    alerts,
    reports,
    activity,
    subscriptions: subscriptions.map((s) => ({ ...s, min_months: Number(s.min_months) })),
    onboarding: {
      withToken: billing.map((b) => b.client_id),
      submitted: intakes.map((i) => i.client_id),
    },
  };
}

function useHealthQuery(clientId: string | null) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: healthKeys.scope(userId, clientId),
    enabled: Boolean(userId),
    refetchInterval: REFRESH_MS,
    queryFn: async (): Promise<Map<string, ClientHealth>> => {
      // `today` se recalcula en cada refetch.
      const today = chileToday();
      return computeClientHealth(await loadHealthSources(clientId, today), new Date());
    },
  });
}

/** Salud de todos los clientes visibles (lista de Clientes y "Hoy"). */
export function useClientsHealth() {
  return useHealthQuery(null);
}

/** Salud de un cliente (ficha). `data` es undefined si el cliente no se puntúa. */
export function useClientHealth(clientId: string) {
  const query = useHealthQuery(clientId);
  return { ...query, health: query.data?.get(clientId) };
}
