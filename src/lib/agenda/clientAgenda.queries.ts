/**
 * Calendario de UN cliente (panel del cliente). Variante de las fuentes de la
 * Agenda de la agencia: cada consulta va filtrada por `client_id`, solo pide lo
 * que el cliente puede ver y todos los enlaces llevan a pantallas de su panel
 * (Plan, Instagram, Facturación, Legal), nunca a páginas de la agencia.
 *
 * Fuera a propósito: borradores de contrato, publicaciones rechazadas o
 * archivadas, cobros pagados/anulados y suscripciones inactivas.
 */
import { useEffect } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/pricing/plans";
import {
  CANCELLED_BOOKING_STATUSES,
  STALE_MS,
  combineAgendaSources,
  fetchAllPages,
  money,
  truncate,
  type AgendaData,
} from "./agenda.queries";
import { chileDayStartIso, dayKeyOf } from "./dates";
import type { AgendaItem, AgendaKind, AgendaRange } from "./types";

export const clientAgendaKeys = {
  all: ["client-agenda"] as const,
  source: (kind: AgendaKind, clientId: string, range: AgendaRange) =>
    ["client-agenda", kind, clientId, range.from, range.to] as const,
};

/** Estados de contrato que el cliente ya recibió (los borradores son internos). */
const CLIENT_CONTRACT_STATUSES = ["sent", "signed"] as const;

interface Scope {
  clientId: string;
  /** Nombre del cliente (todas las filas son suyas). */
  clientName: string;
}

/** Ruta del panel del cliente, con `?tab=` opcional. */
export function clientPanelHref(clientId: string, section: string, tab?: string): string {
  const base = `/clients/${encodeURIComponent(clientId)}/${section}`;
  return tab ? `${base}?tab=${tab}` : base;
}

function base(scope: Scope) {
  return { clientId: scope.clientId, clientName: scope.clientName };
}

async function fetchPosts(range: AgendaRange, scope: Scope): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Publicaciones", (from, to) =>
    supabase
      .from("instagram_posts")
      .select("id,scheduled_at,approval_status,caption")
      .eq("client_id", scope.clientId)
      .is("archived_at", null)
      .not("scheduled_at", "is", null)
      .or("approval_status.is.null,approval_status.neq.rechazado")
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
            ...base(scope),
            id: `publicacion:${p.id}`,
            kind: "publicacion" as const,
            date: p.scheduled_at,
            allDay: false,
            title: p.caption ? truncate(p.caption) : "Publicación sin texto",
            status: p.approval_status,
            href: clientPanelHref(scope.clientId, "instagram", "calendario"),
          },
        ]
      : [],
  );
}

async function fetchDeliverables(range: AgendaRange, scope: Scope): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Entregables", (from, to) =>
    supabase
      .from("deliverables")
      .select("id,due_date,title,status")
      .eq("client_id", scope.clientId)
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
            ...base(scope),
            id: `entregable:${d.id}`,
            kind: "entregable" as const,
            date: d.due_date,
            allDay: true,
            title: truncate(d.title),
            status: d.status,
            href: clientPanelHref(scope.clientId, "plan", "etapas"),
          },
        ]
      : [],
  );
}

async function fetchTasks(range: AgendaRange, scope: Scope): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Tareas", (from, to) =>
    supabase
      .from("client_tasks")
      .select("id,due_date,title,status")
      .eq("client_id", scope.clientId)
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
            ...base(scope),
            id: `tarea:${t.id}`,
            kind: "tarea" as const,
            date: t.due_date,
            allDay: true,
            title: truncate(t.title),
            status: t.status,
            href: clientPanelHref(scope.clientId, "plan", "tareas"),
          },
        ]
      : [],
  );
}

async function fetchObjectives(range: AgendaRange, scope: Scope): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Objetivos", (from, to) =>
    supabase
      .from("objectives")
      .select("id,due_date,title,status")
      .eq("client_id", scope.clientId)
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
            ...base(scope),
            id: `objetivo:${o.id}`,
            kind: "objetivo" as const,
            date: o.due_date,
            allDay: true,
            title: truncate(o.title),
            status: o.status,
            href: clientPanelHref(scope.clientId, "plan", "objetivos"),
          },
        ]
      : [],
  );
}

async function fetchPayments(range: AgendaRange, scope: Scope): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Cobros", (from, to) =>
    supabase
      .from("payments")
      .select("id,due_date,amount,currency,description,status")
      .eq("client_id", scope.clientId)
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
            ...base(scope),
            id: `pago:${p.id}`,
            kind: "pago" as const,
            date: p.due_date,
            allDay: true,
            title: truncate(`${p.description || "Cobro"} · ${money(p.amount, p.currency)}`),
            status: p.status,
            href: clientPanelHref(scope.clientId, "facturacion", "pagos"),
          },
        ]
      : [],
  );
}

async function fetchSubscriptions(range: AgendaRange, scope: Scope): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Suscripciones", (from, to) =>
    supabase
      .from("subscriptions")
      .select("id,next_charge_date,amount_clp,plan_key,status")
      .eq("client_id", scope.clientId)
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
            ...base(scope),
            id: `suscripcion:${s.id}`,
            kind: "suscripcion" as const,
            date: s.next_charge_date,
            allDay: true,
            title: truncate(`Cargo de suscripción ${s.plan_key} · ${formatMoney(s.amount_clp)}`),
            status: s.status,
            href: clientPanelHref(scope.clientId, "facturacion", "pagos"),
          },
        ]
      : [],
  );
}

async function fetchContracts(range: AgendaRange, scope: Scope): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Contratos", (from, to) =>
    supabase
      .from("client_contracts")
      .select("id,effective_date,title,status")
      .eq("client_id", scope.clientId)
      .in("status", [...CLIENT_CONTRACT_STATUSES])
      .gte("effective_date", range.from)
      .lt("effective_date", range.to)
      .order("effective_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data.flatMap((c) =>
    c.effective_date
      ? [
          {
            ...base(scope),
            id: `contrato:${c.id}`,
            kind: "contrato" as const,
            date: c.effective_date,
            allDay: true,
            title: truncate(`Inicio de contrato: ${c.title}`),
            status: c.status,
            href: clientPanelHref(scope.clientId, "legal"),
          },
        ]
      : [],
  );
}

/** Reservas ligadas al cliente; no tienen pantalla propia en su panel: abren el día en su calendario. */
async function fetchBookings(range: AgendaRange, scope: Scope): Promise<AgendaItem[]> {
  const data = await fetchAllPages("Reservas", (from, to) =>
    supabase
      .from("bookings")
      .select("id,scheduled_at,duration_minutes,customer_name,status")
      .eq("client_id", scope.clientId)
      .not("status", "in", CANCELLED_BOOKING_STATUSES)
      .gte("scheduled_at", chileDayStartIso(range.from))
      .lt("scheduled_at", chileDayStartIso(range.to))
      .order("scheduled_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data.map((b) => ({
    ...base(scope),
    id: `reserva:${b.id}`,
    kind: "reserva" as const,
    date: b.scheduled_at,
    allDay: false,
    title: truncate(`${b.customer_name} · ${b.duration_minutes} min`),
    status: b.status,
    href: `${clientPanelHref(scope.clientId, "calendario")}?fecha=${dayKeyOf(b.scheduled_at, false)}`,
  }));
}

type ClientFetcher = (range: AgendaRange, scope: Scope) => Promise<AgendaItem[]>;

const CLIENT_FETCHERS: Readonly<Record<AgendaKind, ClientFetcher>> = {
  publicacion: fetchPosts,
  entregable: fetchDeliverables,
  tarea: fetchTasks,
  objetivo: fetchObjectives,
  pago: fetchPayments,
  suscripcion: fetchSubscriptions,
  contrato: fetchContracts,
  reserva: fetchBookings,
};

function useClientSource(kind: AgendaKind, range: AgendaRange, scope: Scope) {
  return useQuery({
    queryKey: clientAgendaKeys.source(kind, scope.clientId, range),
    enabled: Boolean(scope.clientId),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
    queryFn: () => CLIENT_FETCHERS[kind](range, scope),
  });
}

/** Todas las fuentes del calendario del cliente, combinadas y ordenadas. */
export function useClientAgendaData(range: AgendaRange, scope: Scope): AgendaData {
  const results: Array<[AgendaKind, UseQueryResult<AgendaItem[]>]> = [
    ["publicacion", useClientSource("publicacion", range, scope)],
    ["entregable", useClientSource("entregable", range, scope)],
    ["tarea", useClientSource("tarea", range, scope)],
    ["objetivo", useClientSource("objetivo", range, scope)],
    ["pago", useClientSource("pago", range, scope)],
    ["suscripcion", useClientSource("suscripcion", range, scope)],
    ["contrato", useClientSource("contrato", range, scope)],
    ["reserva", useClientSource("reserva", range, scope)],
  ];
  return combineAgendaSources(results);
}

/** Precarga el rango indicado (p. ej. el mes siguiente) para navegar sin espera. */
export function usePrefetchClientAgendaRange(range: AgendaRange, scope: Scope) {
  const queryClient = useQueryClient();
  const { from, to } = range;
  const { clientId, clientName } = scope;
  useEffect(() => {
    if (!clientId) return;
    const target = { from, to };
    const targetScope = { clientId, clientName };
    for (const [kind, fetcher] of Object.entries(CLIENT_FETCHERS) as Array<
      [AgendaKind, ClientFetcher]
    >) {
      void queryClient.prefetchQuery({
        queryKey: clientAgendaKeys.source(kind, clientId, target),
        queryFn: () => fetcher(target, targetScope),
        staleTime: STALE_MS,
      });
    }
  }, [queryClient, clientId, clientName, from, to]);
}
