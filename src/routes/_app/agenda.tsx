import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Link2,
  RotateCw,
} from "lucide-react";
import { useMemo } from "react";
import { ErrorState, PageContainer, PageHeader, Panel } from "@/components/app";
import { AgendaCalendar, AgendaCalendarSkeleton } from "@/components/agenda/AgendaCalendar";
import { AgendaFilters } from "@/components/agenda/AgendaFilters";
import { AgendaLegend } from "@/components/agenda/AgendaLegend";
import { DayPanel } from "@/components/agenda/DayPanel";
import { BookingsPanel } from "@/components/bookings/BookingsPanel";
import { UpcomingBookings } from "@/components/bookings/UpcomingBookings";
import { useClientList } from "@/components/shell/useClientList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAgendaData, usePrefetchAgendaRange } from "@/lib/agenda/agenda.queries";
import {
  addDays,
  addMonths,
  dayKeyOf,
  formatMonth,
  formatShortDay,
  isDayKey,
  monthRange,
  rangeForView,
} from "@/lib/agenda/dates";
import { useChileToday } from "@/lib/agenda/useChileToday";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AGENDA_KINDS,
  AGENDA_KIND_LABEL_PLURAL,
  isAgendaKind,
  type AgendaItem,
  type AgendaKind,
  type AgendaRange,
  type AgendaView,
} from "@/lib/agenda/types";

interface AgendaSearch {
  tab?: "reservas";
  vista?: "semana" | "lista";
  fecha?: string;
  /** Tipos separados por coma; ausente = todos. */
  tipos?: string;
  cliente?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseKinds(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const kinds = AGENDA_KINDS.filter((k) => raw.split(",").includes(k));
  return kinds.length > 0 && kinds.length < AGENDA_KINDS.length ? kinds.join(",") : undefined;
}

export const Route = createFileRoute("/_app/agenda")({
  validateSearch: (s: Record<string, unknown>): AgendaSearch => ({
    tab: s.tab === "reservas" ? "reservas" : undefined,
    vista: s.vista === "semana" || s.vista === "lista" ? s.vista : undefined,
    fecha: isDayKey(s.fecha) ? s.fecha : undefined,
    tipos: parseKinds(s.tipos),
    cliente: typeof s.cliente === "string" && UUID_RE.test(s.cliente) ? s.cliente : undefined,
  }),
  component: AgendaPage,
  head: () => ({
    meta: [
      { title: "Agenda · Vibranding" },
      {
        name: "description",
        content:
          "Publicaciones, entregables, tareas, cobros, contratos y reservas en un solo calendario.",
      },
    ],
  }),
});

function AgendaPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/agenda" });
  const setSearch = (patch: Partial<AgendaSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Todo lo que tiene fecha: publicaciones, entregas, cobros, contratos y reservas."
      />
      <Tabs
        value={search.tab ?? "calendario"}
        onValueChange={(v) => setSearch({ tab: v === "reservas" ? "reservas" : undefined })}
      >
        <TabsList>
          <TabsTrigger value="calendario" className="gap-1.5">
            <CalendarDays aria-hidden className="h-4 w-4" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="reservas" className="gap-1.5">
            <Link2 aria-hidden className="h-4 w-4" />
            Mi link de reservas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calendario" className="mt-4">
          <CalendarTab search={search} setSearch={setSearch} />
        </TabsContent>
        <TabsContent value="reservas" className="mt-4 space-y-6">
          <Panel title="Próximas reservas">
            <UpcomingBookings />
          </Panel>
          <BookingsPanel />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

interface CalendarTabProps {
  search: AgendaSearch;
  setSearch: (patch: Partial<AgendaSearch>) => void;
}

function queryRange(view: AgendaView, anchor: string): AgendaRange {
  return view === "lista" ? monthRange(anchor) : rangeForView(view, anchor);
}

function step(view: AgendaView, anchor: string, dir: 1 | -1): string {
  return view === "semana" ? addDays(anchor, 7 * dir) : addMonths(anchor, dir);
}

function periodLabel(view: AgendaView, range: AgendaRange, anchor: string): string {
  if (view !== "semana") return formatMonth(anchor);
  return `${formatShortDay(range.from)} – ${formatShortDay(addDays(range.to, -1))}`;
}

function CalendarTab({ search, setSearch }: CalendarTabProps) {
  const today = useChileToday();
  const isMobile = useIsMobile();
  // La vista Lista es solo para móvil; en escritorio cae a Mes.
  const view: AgendaView = search.vista === "lista" && !isMobile ? "mes" : (search.vista ?? "mes");
  const selected = search.fecha ?? today;
  const range = useMemo(() => queryRange(view, selected), [view, selected]);
  const nextRange = useMemo(() => queryRange(view, step(view, selected, 1)), [view, selected]);

  const agenda = useAgendaData(range);
  usePrefetchAgendaRange(nextRange);
  const clientsQuery = useClientList(true);
  const clients = clientsQuery.data ?? [];

  const kinds = useMemo(
    (): AgendaKind[] | null => (search.tipos ? search.tipos.split(",").filter(isAgendaKind) : null),
    [search.tipos],
  );
  // Un ?cliente= desconocido (id viejo o inventado) se ignora una vez cargada la lista.
  const clientId =
    search.cliente && (!clientsQuery.data || clients.some((c) => c.id === search.cliente))
      ? search.cliente
      : null;

  const byClient = useMemo(
    () => (clientId ? agenda.items.filter((it) => it.clientId === clientId) : agenda.items),
    [agenda.items, clientId],
  );
  const counts = useMemo(() => {
    const base = Object.fromEntries(AGENDA_KINDS.map((k) => [k, 0])) as Record<AgendaKind, number>;
    return byClient.reduce((acc, it) => ({ ...acc, [it.kind]: acc[it.kind] + 1 }), base);
  }, [byClient]);
  const visible = useMemo(
    () => (kinds ? byClient.filter((it) => kinds.includes(it.kind)) : byClient),
    [byClient, kinds],
  );
  const itemsByDay = useMemo(() => groupByDay(visible), [visible]);

  const selectDay = (day: string) => setSearch({ fecha: day === today ? undefined : day });
  const setView = (v: string) => {
    if (v === "mes" || v === "semana" || v === "lista") {
      setSearch({ vista: v === "mes" ? undefined : v });
    }
  };

  return (
    <div className="space-y-4">
      <AgendaFilters
        kinds={kinds}
        clientId={clientId}
        clients={clients}
        counts={counts}
        onKindsChange={(k) => setSearch({ tipos: k ? k.join(",") : undefined })}
        onClientChange={(id) => setSearch({ cliente: id ?? undefined })}
        onClear={() => setSearch({ tipos: undefined, cliente: undefined })}
      />

      {agenda.failed.length > 0 && !agenda.allFailed && (
        <PartialErrorNotice
          labels={agenda.failed.map((s) => AGENDA_KIND_LABEL_PLURAL[s.kind])}
          retrying={agenda.failed.some((s) => s.isFetching)}
          onRetry={agenda.refetchFailed}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          bodyClassName="px-2 pb-3 sm:px-4 sm:pb-4"
          title={<span className="capitalize">{periodLabel(view, range, selected)}</span>}
          actions={
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label={view === "semana" ? "Semana anterior" : "Mes anterior"}
                onClick={() => setSearch({ fecha: step(view, selected, -1) })}
              >
                <ChevronLeft aria-hidden className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => selectDay(today)}>
                Hoy
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label={view === "semana" ? "Semana siguiente" : "Mes siguiente"}
                onClick={() => setSearch({ fecha: step(view, selected, 1) })}
              >
                <ChevronRight aria-hidden className="h-4 w-4" />
              </Button>
            </div>
          }
        >
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={view}
            onValueChange={setView}
            aria-label="Vista del calendario"
            className="mb-3 justify-start"
          >
            <ToggleGroupItem value="mes" className="h-8 px-3 text-xs">
              Mes
            </ToggleGroupItem>
            <ToggleGroupItem value="semana" className="h-8 px-3 text-xs">
              Semana
            </ToggleGroupItem>
            <ToggleGroupItem value="lista" className="h-8 px-3 text-xs md:hidden">
              Lista
            </ToggleGroupItem>
          </ToggleGroup>

          <p role="status" aria-live="polite" className="sr-only">
            {agenda.isRefreshing ? "Actualizando agenda…" : ""}
          </p>
          {agenda.allFailed ? (
            <ErrorState
              title="No pudimos cargar la agenda"
              message="Revisa tu conexión e inténtalo de nuevo."
              onRetry={agenda.refetchFailed}
              retrying={agenda.sources.some((s) => s.isFetching)}
            />
          ) : agenda.isLoading ? (
            <AgendaCalendarSkeleton />
          ) : (
            <div
              aria-busy={agenda.isRefreshing}
              className={
                agenda.isRefreshing ? "opacity-70 transition-opacity" : "transition-opacity"
              }
            >
              <AgendaCalendar
                view={view}
                range={range}
                selected={selected}
                today={today}
                itemsByDay={itemsByDay}
                onSelectDay={selectDay}
              />
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          {view !== "lista" && (
            <Panel>
              <DayPanel
                day={selected}
                isToday={selected === today}
                items={itemsByDay.get(selected) ?? []}
              />
            </Panel>
          )}
          <Panel title="Leyenda">
            <AgendaLegend />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function groupByDay(items: readonly AgendaItem[]): Map<string, AgendaItem[]> {
  return items.reduce((map, it) => {
    const key = dayKeyOf(it.date, it.allDay);
    return map.set(key, [...(map.get(key) ?? []), it]);
  }, new Map<string, AgendaItem[]>());
}

function PartialErrorNotice({
  labels,
  retrying,
  onRetry,
}: {
  labels: string[];
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-app-md border border-warning/40 bg-warning-subtle px-3 py-2 text-xs text-warning-strong"
    >
      <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        No pudimos cargar: {labels.join(", ")}. El resto de la agenda está al día.
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={onRetry}
        disabled={retrying}
      >
        <RotateCw aria-hidden className={`mr-1 h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
        Reintentar
      </Button>
    </div>
  );
}
