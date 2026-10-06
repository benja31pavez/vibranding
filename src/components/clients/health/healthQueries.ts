import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PAGE_SIZE, fetchAllRows, type PageResult } from "@/lib/db/fetchAllRows";
import { chileToday } from "@/lib/dates/chile";
import {
  SCORED_CLIENT_STATUSES,
  activitySince,
  closedPeriod,
  computeClientHealth,
  type ClientHealth,
  type HealthClientInput,
  type HealthSources,
} from "@/lib/health";
import { healthKeys } from "./healthKeys";

/**
 * Datos de "Salud del cliente". Lee con la sesión del usuario (RLS) solo las
 * columnas necesarias y aplica las reglas puras de src/lib/health.
 *
 * - Todas las consultas hijas se acotan a los ids de clientes puntuables, en
 *   lotes de CLIENT_CHUNK, y se paginan con orden estable (fecha desc, id).
 * - Si un lote llega a SAFETY_CAP filas, sus clientes quedan como "Sin datos
 *   suficientes" en vez de puntuarse con datos truncados.
 * - Con `clientId` todo se acota a ese cliente (ficha).
 */

const STALE_MS = 5 * 60 * 1000;
const REFRESH_MS = 10 * 60 * 1000;
/** Ids por filtro `in` (largo de URL de PostgREST). */
const CLIENT_CHUNK = 200;
/** Tope de filas por fuente y lote; al alcanzarlo los datos se consideran incompletos. */
const SAFETY_CAP = 5 * PAGE_SIZE;
const APPROVAL_KINDS = ["entregable", "post_instagram"];

export const HEALTH_LOAD_ERROR = "No pudimos calcular la salud de los clientes. Intenta de nuevo.";

type Page<T> = (from: number, to: number) => PageResult<T>;

interface Capped<T> {
  rows: T[];
  partialIds: string[];
}

function chunks<T>(list: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, (i + 1) * size),
  );
}

/** Pagina hasta una página incompleta o hasta SAFETY_CAP filas (truncated). */
async function fetchCapped<T>(page: Page<T>): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < SAFETY_CAP; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/** Una fuente para todos los clientes, en lotes de ids; marca los lotes truncados. */
async function byClients<T>(
  ids: readonly string[],
  build: (part: string[]) => Page<T>,
): Promise<Capped<T>> {
  const parts = chunks(ids, CLIENT_CHUNK);
  const results = await Promise.all(parts.map((part) => fetchCapped(build(part))));
  return {
    rows: results.flatMap((r) => r.rows),
    partialIds: results.flatMap((r, i) => (r.truncated ? parts[i] : [])),
  };
}

async function loadClients(clientId: string | null): Promise<HealthClientInput[]> {
  const statuses = [...SCORED_CLIENT_STATUSES];
  const columns = "id,name,status,created_at,started_at";
  if (clientId) {
    const { data, error } = await supabase
      .from("clients")
      .select(columns)
      .eq("id", clientId)
      .in("status", statuses);
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  return fetchAllRows((from, to) =>
    supabase.from("clients").select(columns).in("status", statuses).order("id").range(from, to),
  );
}

/** Señales del lado del cliente: sus comentarios, aprobaciones, pagos y reportes enviados. */
function loadActivity(ids: readonly string[], since: string) {
  return Promise.all([
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("deliverable_comments")
          .select("id,client_id,created_at")
          .in("client_id", part)
          .eq("author_role", "client")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
    ),
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("instagram_posts")
          .select("id,client_id,approved_at")
          .in("client_id", part)
          .gte("approved_at", since)
          .order("approved_at", { ascending: false })
          .order("id")
          .range(from, to),
    ),
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("payments")
          .select("id,client_id,paid_at")
          .in("client_id", part)
          .gte("paid_at", since)
          .order("paid_at", { ascending: false })
          .order("id")
          .range(from, to),
    ),
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("monthly_reports")
          .select("id,client_id,sent_at")
          .in("client_id", part)
          .gte("sent_at", since)
          .order("sent_at", { ascending: false })
          .order("id")
          .range(from, to),
    ),
  ]);
}

function loadSignals(ids: readonly string[], today: string) {
  return Promise.all([
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("payments")
          .select("id,client_id,status,due_date")
          .in("client_id", part)
          .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${today})`)
          .order("due_date", { ascending: false })
          .order("id")
          .range(from, to),
    ),
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("approval_queue")
          .select("ref_id,client_id,created_at")
          .in("client_id", part)
          .in("kind", APPROVAL_KINDS)
          .order("created_at", { ascending: false })
          .order("ref_id")
          .range(from, to),
    ),
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("instagram_posts")
          .select("id,client_id,updated_at")
          .in("client_id", part)
          .eq("approval_status", "cambios")
          .is("archived_at", null)
          .order("updated_at", { ascending: false })
          .order("id")
          .range(from, to),
    ),
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("deliverable_comments")
          .select("id,client_id,created_at")
          .in("client_id", part)
          .eq("kind", "change_request")
          .eq("read_by_agency", false)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
    ),
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("campaign_alerts")
          .select("id,client_id,severity,created_at")
          .in("client_id", part)
          .is("resolved_at", null)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
    ),
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("monthly_reports")
          .select("id,client_id,period,sent_at")
          .in("client_id", part)
          .eq("period", closedPeriod(today))
          .order("id")
          .range(from, to),
    ),
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("payments")
          .select("id,client_id,status,plan_key,paid_at,period_start,period_end")
          .in("client_id", part)
          .eq("status", "paid")
          .not("period_end", "is", null)
          .gte("period_end", today)
          .order("period_end", { ascending: false })
          .order("id")
          .range(from, to),
    ),
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("client_billing")
          .select("client_id")
          .in("client_id", part)
          .not("onboarding_token", "is", null)
          .order("client_id")
          .range(from, to),
    ),
    byClients(
      ids,
      (part) => (from, to) =>
        supabase
          .from("client_intake")
          .select("client_id")
          .in("client_id", part)
          .order("client_id")
          .range(from, to),
    ),
  ]);
}

export async function loadHealthSources(
  clientId: string | null,
  today: string,
): Promise<HealthSources> {
  const clients = await loadClients(clientId);
  const ids = clients.map((c) => c.id);
  const since = `${activitySince(today)}T00:00:00Z`;
  const [signals, activity] = await Promise.all([
    loadSignals(ids, today),
    loadActivity(ids, since),
  ]);
  const [
    payments,
    approvals,
    igChanges,
    commentChanges,
    alerts,
    reports,
    planPayments,
    billing,
    intakes,
  ] = signals;
  const [comments, approved, paid, sent] = activity;
  const partialIds = [...signals, ...activity].flatMap((s: Capped<unknown>) => s.partialIds);

  return {
    clients,
    payments: payments.rows,
    approvals: approvals.rows,
    changeRequests: [
      ...igChanges.rows.map((r) => ({ client_id: r.client_id, created_at: r.updated_at })),
      ...commentChanges.rows,
    ],
    alerts: alerts.rows,
    reports: reports.rows,
    activity: [
      ...comments.rows.map((r) => ({ client_id: r.client_id, at: r.created_at })),
      ...approved.rows.map((r) => ({ client_id: r.client_id, at: r.approved_at })),
      ...paid.rows.map((r) => ({ client_id: r.client_id, at: r.paid_at })),
      ...sent.rows.map((r) => ({ client_id: r.client_id, at: r.sent_at })),
    ],
    planPayments: planPayments.rows,
    onboarding: {
      withToken: billing.rows.map((b) => b.client_id),
      submitted: intakes.rows.map((i) => i.client_id),
    },
    partialClientIds: [...new Set(partialIds)],
  };
}

function useHealthQuery(clientId: string | null, enabled = true) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: healthKeys.scope(userId, clientId),
    enabled: Boolean(userId) && enabled,
    staleTime: STALE_MS,
    refetchInterval: REFRESH_MS,
    queryFn: async (): Promise<Map<string, ClientHealth>> => {
      try {
        // `today` se recalcula en cada refetch.
        const today = chileToday();
        return computeClientHealth(await loadHealthSources(clientId, today), new Date());
      } catch (e) {
        console.error("[salud] error al calcular la salud de clientes", { clientId, error: e });
        throw new Error(HEALTH_LOAD_ERROR);
      }
    },
  });
}

/** Salud de todos los clientes visibles (lista de Clientes y "Hoy"). */
export function useClientsHealth(options: { enabled?: boolean } = {}) {
  return useHealthQuery(null, options.enabled ?? true);
}

/** Salud de un cliente (ficha). `health` es undefined si el cliente no se puntúa. */
export function useClientHealth(clientId: string) {
  const query = useHealthQuery(clientId);
  return { ...query, health: query.data?.get(clientId) };
}
