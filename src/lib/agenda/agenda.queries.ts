/**
 * Fuentes de la Agenda: un hook de TanStack Query por tabla, cada uno con su
 * propio estado de error para que una fuente caída no oculte las demás.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { chileDayStartIso } from "./dates";
import type { AgendaItem, AgendaKind, AgendaRange } from "./types";

/** Keys de React Query de la Agenda; acotadas por usuario y rango. */
export const agendaKeys = {
  all: ["agenda"] as const,
  source: (kind: AgendaKind, userId: string, range: AgendaRange) =>
    ["agenda", kind, userId, range.from, range.to] as const,
};

const STALE_MS = 60_000;
const TITLE_MAX = 80;
const NO_CLIENT = "Sin cliente";
const CANCELLED_BOOKING_STATUSES = "(cancelled,canceled,cancelado)";

type ClientRef = { name: string } | null;

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function money(amount: number, currency = "CLP"): string {
  if (currency === "CLP") return CLP.format(amount);
  return new Intl.NumberFormat("es-CL", { style: "currency", currency }).format(amount);
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
  return new Map((data ?? []).map((c) => [c.id, c.name]));
}

function fail(source: string, message: string): never {
  throw new Error(`${source}: ${message}`);
}

// ─── Fetchers (exportados para pruebas y prefetch) ──────────────────────────

export async function fetchPostItems(range: AgendaRange): Promise<AgendaItem[]> {
  const { data, error } = await supabase
    .from("instagram_posts")
    .select("id,scheduled_at,approval_status,caption,client_id,client:clients(name)")
    .is("archived_at", null)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", chileDayStartIso(range.from))
    .lt("scheduled_at", chileDayStartIso(range.to));
  if (error) fail("Publicaciones", error.message);
  return (data ?? []).flatMap((p) =>
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
  const { data, error } = await supabase
    .from("deliverables")
    .select("id,due_date,title,status,client_id,client:clients(name)")
    .gte("due_date", range.from)
    .lt("due_date", range.to);
  if (error) fail("Entregables", error.message);
  return (data ?? []).flatMap((d) =>
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
  const { data, error } = await supabase
    .from("client_tasks")
    .select("id,due_date,title,status,client_id,client:clients(name)")
    .gte("due_date", range.from)
    .lt("due_date", range.to);
  if (error) fail("Tareas", error.message);
  return (data ?? []).flatMap((t) =>
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
  const { data, error } = await supabase
    .from("objectives")
    .select("id,due_date,title,status,client_id,client:clients(name)")
    .gte("due_date", range.from)
    .lt("due_date", range.to);
  if (error) fail("Objetivos", error.message);
  return (data ?? []).flatMap((o) =>
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
  const { data, error } = await supabase
    .from("payments")
    .select("id,due_date,amount,currency,description,status,client_id,client:clients(name)")
    .in("status", ["pending", "overdue"])
    .gte("due_date", range.from)
    .lt("due_date", range.to);
  if (error) fail("Cobros", error.message);
  return (data ?? []).flatMap((p) =>
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
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id,next_charge_date,amount_clp,plan_key,status,client_id,client:clients(name)")
    .eq("status", "activa")
    .gte("next_charge_date", range.from)
    .lt("next_charge_date", range.to);
  if (error) fail("Suscripciones", error.message);
  return (data ?? []).flatMap((s) =>
    s.next_charge_date
      ? [
          {
            id: `suscripcion:${s.id}`,
            kind: "suscripcion" as const,
            date: s.next_charge_date,
            allDay: true,
            clientId: s.client_id,
            clientName: (s.client as ClientRef)?.name ?? NO_CLIENT,
            title: truncate(`Cargo de suscripción ${s.plan_key} · ${money(s.amount_clp)}`),
            status: s.status,
            href: clientHref(s.client_id, "facturacion", "pagos"),
          },
        ]
      : [],
  );
}

export async function fetchContractItems(range: AgendaRange): Promise<AgendaItem[]> {
  const { data, error } = await supabase
    .from("client_contracts")
    .select("id,effective_date,title,status,client_id")
    .neq("status", "cancelled")
    .gte("effective_date", range.from)
    .lt("effective_date", range.to);
  if (error) fail("Contratos", error.message);
  const rows = data ?? [];
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
            href: clientHref(c.client_id, "facturacion", "contratos"),
          },
        ]
      : [],
  );
}

export async function fetchBookingItems(range: AgendaRange, userId: string): Promise<AgendaItem[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id,scheduled_at,duration_minutes,customer_name,status,client_id,client:clients(name)")
    .eq("owner_user_id", userId)
    .not("status", "in", CANCELLED_BOOKING_STATUSES)
    .gte("scheduled_at", chileDayStartIso(range.from))
    .lt("scheduled_at", chileDayStartIso(range.to));
  if (error) fail("Reservas", error.message);
  return (data ?? []).map((b) => ({
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

function useAgendaSource(kind: AgendaKind, fetcher: Fetcher, range: AgendaRange) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: agendaKeys.source(kind, userId, range),
    enabled: Boolean(userId),
    staleTime: STALE_MS,
    queryFn: () => fetcher(range, userId),
  });
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
  isError: boolean;
  isFetching: boolean;
  errorMessage: string | null;
  refetch: () => void;
}

export interface AgendaData {
  items: AgendaItem[];
  sources: AgendaSourceState[];
  /** Ninguna fuente terminó todavía (primera carga). */
  isLoading: boolean;
  /** Todas las fuentes fallaron. */
  allFailed: boolean;
  failed: AgendaSourceState[];
  refetchFailed: () => void;
}

function toState(kind: AgendaKind, q: UseQueryResult<AgendaItem[]>): AgendaSourceState {
  return {
    kind,
    isPending: q.isPending,
    isError: q.isError,
    isFetching: q.isFetching,
    errorMessage: q.error instanceof Error ? q.error.message : q.error ? String(q.error) : null,
    refetch: () => void q.refetch(),
  };
}

function byDate(a: AgendaItem, b: AgendaItem): number {
  // Los de día completo van antes que los con hora el mismo día.
  if (a.allDay !== b.allDay && a.date.slice(0, 10) === b.date.slice(0, 10)) {
    return a.allDay ? -1 : 1;
  }
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
    allFailed: failed.length === sources.length,
    failed,
    refetchFailed: () => failed.forEach((s) => s.refetch()),
  };
}
