/**
 * Fuentes de la Agenda: un hook de TanStack Query por tabla, cada uno con su
 * propio estado de error para que una fuente caída no oculte las demás.
 */
import { useEffect } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  formatMoney,
  formatPlainAmount,
  isLegacyCurrency,
  legacyCurrencyLabel,
} from "@/lib/pricing/plans";
import { chileDayStartIso, dayKeyOf } from "./dates";
import type { AgendaItem, AgendaKind, AgendaRange } from "./types";

/** Keys de React Query de la Agenda; acotadas por usuario y rango. */
export const agendaKeys = {
  all: ["agenda"] as const,
  source: (kind: AgendaKind, userId: string, range: AgendaRange) =>
    ["agenda", kind, userId, range.from, range.to] as const,
};

const STALE_MS = 60_000;
/** Ids por consulta `.in()` para no exceder el largo de URL. */
const IN_CHUNK = 200;
const TITLE_MAX = 80;
const NO_CLIENT = "Sin cliente";
const CANCELLED_BOOKING_STATUSES = "(cancelled,canceled,cancelado)";

type ClientRef = { name: string } | null;

/** Montos en CLP; un registro antiguo en otra moneda se marca, no se hace pasar por pesos. */
function money(amount: number, currency: string | null | undefined): string {
  if (isLegacyCurrency(currency))
    return `${formatPlainAmount(amount)} (${legacyCurrencyLabel(currency)})`;
  return formatMoney(amount);
}

function truncate(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > TITLE_MAX ? `${clean.slice(0, TITLE_MAX - 1)}…` : clean;
}

function clientHref(clientId: string, section: string, tab?: string): string {
  const base = `/clients/${encodeURIComponent(clientId)}/${section}`;
  return tab ? `${base}?tab=${tab}` : base;
}

/** Nombres de clientes para tablas sin FK declarada hacia `clients`. */
async function clientNames(ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from("clients").select("id,name").in("id", unique);
  if (error) throw new Error(error.message);
  return new Map(data.map((c) => [c.id, c.name]));
}

function fail(source: string, message: string): never {
  throw new Error(`${source}: ${message}`);
}

const PAGE_SIZE = 1000;
/** Tope de seguridad: 50 lotes = 50.000 filas por fuente y rango. */
const MAX_PAGES = 50;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Trae todas las filas en lotes de PAGE_SIZE (la consulta debe tener orden estable). */
async function fetchAllPages<T>(
  source: string,
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  let rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const from = i * PAGE_SIZE;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) fail(source, error.message);
    const batch = data ?? [];
    rows = [...rows, ...batch];
    if (batch.length < PAGE_SIZE) return rows;
  }
  return fail(source, "demasiados eventos en el período; acota el rango o los filtros");
}

// ─── Fetchers (exportados para pruebas y prefetch) ──────────────────────────

export async function fetchPostItems(range: AgendaRange): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Publicaciones", (from, to) =>
    supabase
      .from("instagram_posts")
      .select("id,scheduled_at,approval_status,caption,client_id,client:clients(name)")
      .is("archived_at", null)
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", chileDayStartIso(range.from))
      .lt("scheduled_at", chileDayStartIso(range.to))
      .order("scheduled_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data.flatMap((p) =>
    p.scheduled_at
      ? [
          {
            id: `publicacion:${p.id}`,
            kind: "publicacion" as const,
            date: p.scheduled_at,
            allDay: false,
            clientId: p.client_id,
            clientName: (p.client as ClientRef)?.name ?? NO_CLIENT,
            title: p.caption ? truncate(p.caption) : "Publicación sin texto",
            status: p.approval_status,
            href: clientHref(p.client_id, "instagram", "calendario"),
          },
        ]
      : [],
  );
}

export async function fetchDeliverableItems(range: AgendaRange): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Entregables", (from, to) =>
    supabase
      .from("deliverables")
      .select("id,due_date,title,status,client_id,client:clients(name)")
      .gte("due_date", range.from)
      .lt("due_date", range.to)
      .order("due_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data.flatMap((d) =>
    d.due_date
      ? [
          {
            id: `entregable:${d.id}`,
            kind: "entregable" as const,
            date: d.due_date,
            allDay: true,
            clientId: d.client_id,
            clientName: (d.client as ClientRef)?.name ?? NO_CLIENT,
            title: truncate(d.title),
            status: d.status,
            href: clientHref(d.client_id, "deliverables"),
          },
        ]
      : [],
  );
}

export async function fetchTaskItems(range: AgendaRange): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Tareas", (from, to) =>
    supabase
      .from("client_tasks")
      .select("id,due_date,title,status,client_id,client:clients(name)")
      .gte("due_date", range.from)
      .lt("due_date", range.to)
      .order("due_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data.flatMap((t) =>
    t.due_date
      ? [
          {
            id: `tarea:${t.id}`,
            kind: "tarea" as const,
            date: t.due_date,
            allDay: true,
            clientId: t.client_id,
            clientName: (t.client as ClientRef)?.name ?? NO_CLIENT,
            title: truncate(t.title),
            status: t.status,
            href: clientHref(t.client_id, "plan", "tareas"),
          },
        ]
      : [],
  );
}

export async function fetchObjectiveItems(range: AgendaRange): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Objetivos", (from, to) =>
    supabase
      .from("objectives")
      .select("id,due_date,title,status,client_id,client:clients(name)")
      .gte("due_date", range.from)
      .lt("due_date", range.to)
      .order("due_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data.flatMap((o) =>
    o.due_date
      ? [
          {
            id: `objetivo:${o.id}`,
            kind: "objetivo" as const,
            date: o.due_date,
            allDay: true,
            clientId: o.client_id,
            clientName: (o.client as ClientRef)?.name ?? NO_CLIENT,
            title: truncate(o.title),
            status: o.status,
            href: clientHref(o.client_id, "plan", "objetivos"),
          },
        ]
      : [],
  );
}

export async function fetchPaymentItems(range: AgendaRange): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Cobros", (from, to) =>
    supabase
      .from("payments")
      .select("id,due_date,amount,currency,description,status,client_id,client:clients(name)")
      .in("status", ["pending", "overdue"])
      .gte("due_date", range.from)
      .lt("due_date", range.to)
      .order("due_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data.flatMap((p) =>
    p.due_date
      ? [
          {
            id: `pago:${p.id}`,
            kind: "pago" as const,
            date: p.due_date,
            allDay: true,
            clientId: p.client_id,
            clientName: (p.client as ClientRef)?.name ?? NO_CLIENT,
            title: truncate(`${p.description || "Cobro"} · ${money(p.amount, p.currency)}`),
            status: p.status,
            href: clientHref(p.client_id, "facturacion", "pagos"),
          },
        ]
      : [],
  );
}

export async function fetchSubscriptionItems(range: AgendaRange): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Suscripciones", (from, to) =>
    supabase
      .from("subscriptions")
      .select("id,next_charge_date,amount_clp,plan_key,status,client_id,client:clients(name)")
      .eq("status", "activa")
      .gte("next_charge_date", range.from)
      .lt("next_charge_date", range.to)
      .order("next_charge_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data.flatMap((s) =>
    s.next_charge_date
      ? [
          {
            id: `suscripcion:${s.id}`,
            kind: "suscripcion" as const,
            date: s.next_charge_date,
            allDay: true,
            clientId: s.client_id,
            clientName: (s.client as ClientRef)?.name ?? NO_CLIENT,
            title: truncate(`Cargo de suscripción ${s.plan_key} · ${formatMoney(s.amount_clp)}`),
            status: s.status,
            href: clientHref(s.client_id, "facturacion", "pagos"),
          },
        ]
      : [],
  );
}

export async function fetchContractItems(range: AgendaRange): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Contratos", (from, to) =>
    supabase
      .from("client_contracts")
      .select("id,effective_date,title,status,client_id")
      .neq("status", "cancelled")
      .gte("effective_date", range.from)
      .lt("effective_date", range.to)
      .order("effective_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  const rows = data;
  const names = await clientNames(rows.map((c) => c.client_id)).catch((e: unknown) =>
    fail("Contratos", e instanceof Error ? e.message : String(e)),
  );
  return rows.flatMap((c) =>
    c.effective_date
      ? [
          {
            id: `contrato:${c.id}`,
            kind: "contrato" as const,
            date: c.effective_date,
            allDay: true,
            clientId: c.client_id,
            clientName: names.get(c.client_id) ?? NO_CLIENT,
            title: truncate(`Inicio de contrato: ${c.title}`),
            status: c.status,
            href: clientHref(c.client_id, "legal"),
          },
        ]
      : [],
  );
}

export async function fetchBookingItems(range: AgendaRange, userId: string): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Reservas", (from, to) =>
    supabase
      .from("bookings")
      .select(
        "id,scheduled_at,duration_minutes,customer_name,status,client_id,client:clients(name)",
      )
      .eq("owner_user_id", userId)
      .not("status", "in", CANCELLED_BOOKING_STATUSES)
      .gte("scheduled_at", chileDayStartIso(range.from))
      .lt("scheduled_at", chileDayStartIso(range.to))
      .order("scheduled_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data.map((b) => ({
    id: `reserva:${b.id}`,
    kind: "reserva" as const,
    date: b.scheduled_at,
    allDay: false,
    clientId: b.client_id,
    clientName: (b.client as ClientRef)?.name ?? "Mi agenda",
    title: truncate(`${b.customer_name} · ${b.duration_minutes} min`),
    status: b.status,
    href: "/agenda?tab=reservas",
  }));
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

type Fetcher = (range: AgendaRange, userId: string) => Promise<AgendaItem[]>;

const FETCHERS: Readonly<Record<AgendaKind, Fetcher>> = {
  publicacion: fetchPostItems,
  entregable: fetchDeliverableItems,
  tarea: fetchTaskItems,
  objetivo: fetchObjectiveItems,
  pago: fetchPaymentItems,
  suscripcion: fetchSubscriptionItems,
  contrato: fetchContractItems,
  reserva: fetchBookingItems,
};

function useAgendaSource(kind: AgendaKind, fetcher: Fetcher, range: AgendaRange) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: agendaKeys.source(kind, userId, range),
    enabled: Boolean(userId),
    staleTime: STALE_MS,
    // Al cambiar de mes/semana se mantiene lo anterior hasta que llega lo nuevo (sin parpadeo).
    placeholderData: keepPreviousData,
    queryFn: () => fetcher(range, userId),
  });
}

/** Precarga el rango indicado (p. ej. el mes siguiente) para navegar sin espera. */
export function usePrefetchAgendaRange(range: AgendaRange | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const from = range?.from;
  const to = range?.to;
  useEffect(() => {
    if (!userId || !from || !to) return;
    const target = { from, to };
    for (const [kind, fetcher] of Object.entries(FETCHERS) as Array<[AgendaKind, Fetcher]>) {
      void queryClient.prefetchQuery({
        queryKey: agendaKeys.source(kind, userId, target),
        queryFn: () => fetcher(target, userId),
        staleTime: STALE_MS,
      });
    }
  }, [queryClient, userId, from, to]);
}

export const usePostsAgenda = (range: AgendaRange) =>
  useAgendaSource("publicacion", fetchPostItems, range);
export const useDeliverablesAgenda = (range: AgendaRange) =>
  useAgendaSource("entregable", fetchDeliverableItems, range);
export const useTasksAgenda = (range: AgendaRange) =>
  useAgendaSource("tarea", fetchTaskItems, range);
export const useObjectivesAgenda = (range: AgendaRange) =>
  useAgendaSource("objetivo", fetchObjectiveItems, range);
export const usePaymentsAgenda = (range: AgendaRange) =>
  useAgendaSource("pago", fetchPaymentItems, range);
export const useSubscriptionsAgenda = (range: AgendaRange) =>
  useAgendaSource("suscripcion", fetchSubscriptionItems, range);
export const useContractsAgenda = (range: AgendaRange) =>
  useAgendaSource("contrato", fetchContractItems, range);
export const useBookingsAgenda = (range: AgendaRange) =>
  useAgendaSource("reserva", fetchBookingItems, range);

export interface AgendaSourceState {
  kind: AgendaKind;
  isPending: boolean;
  /** Muestra datos del rango anterior mientras carga el nuevo. */
  isPlaceholderData: boolean;
  isError: boolean;
  isFetching: boolean;
  errorMessage: string | null;
  refetch: () => void;
}

export interface AgendaData {
  items: AgendaItem[];
  sources: AgendaSourceState[];
  /** Primera carga: ninguna fuente tiene datos aún (ni previos). */
  isLoading: boolean;
  /** Hay datos del rango anterior en pantalla mientras llega el nuevo. */
  isRefreshing: boolean;
  /** Todas las fuentes fallaron. */
  allFailed: boolean;
  failed: AgendaSourceState[];
  refetchFailed: () => void;
}

function toState(kind: AgendaKind, q: UseQueryResult<AgendaItem[]>): AgendaSourceState {
  return {
    kind,
    isPending: q.isPending,
    isPlaceholderData: q.isPlaceholderData,
    isError: q.isError,
    isFetching: q.isFetching,
    errorMessage: q.error instanceof Error ? q.error.message : q.error ? String(q.error) : null,
    refetch: () => void q.refetch(),
  };
}

/** Orden por día de Chile; el mismo día, primero los de día completo y luego por hora. */
function byDate(a: AgendaItem, b: AgendaItem): number {
  const dayA = dayKeyOf(a.date, a.allDay);
  const dayB = dayKeyOf(b.date, b.allDay);
  if (dayA !== dayB) return dayA < dayB ? -1 : 1;
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "es");
}

/** Combina todas las fuentes en una lista ordenada con el estado de cada una. */
export function useAgendaData(range: AgendaRange): AgendaData {
  const results: Array<[AgendaKind, UseQueryResult<AgendaItem[]>]> = [
    ["publicacion", usePostsAgenda(range)],
    ["entregable", useDeliverablesAgenda(range)],
    ["tarea", useTasksAgenda(range)],
    ["objetivo", useObjectivesAgenda(range)],
    ["pago", usePaymentsAgenda(range)],
    ["suscripcion", useSubscriptionsAgenda(range)],
    ["contrato", useContractsAgenda(range)],
    ["reserva", useBookingsAgenda(range)],
  ];
  const sources = results.map(([kind, q]) => toState(kind, q));
  const items = results.flatMap(([, q]) => q.data ?? []).sort(byDate);
  const failed = sources.filter((s) => s.isError);
  return {
    items,
    sources,
    isLoading: sources.every((s) => s.isPending && !s.isError),
    isRefreshing: sources.some((s) => s.isPlaceholderData),
    allFailed: failed.length === sources.length,
    failed,
    refetchFailed: () => failed.forEach((s) => s.refetch()),
  };
}
