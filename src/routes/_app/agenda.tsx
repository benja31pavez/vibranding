import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Link2 } from "lucide-react";
import { useMemo } from "react";
import { ErrorState, FitPage, PageHeader, Panel } from "@/components/app";
import { AgendaCalendar, AgendaCalendarSkeleton } from "@/components/agenda/AgendaCalendar";
import { AgendaFilters } from "@/components/agenda/AgendaFilters";
import { AgendaLegend } from "@/components/agenda/AgendaLegend";
import { DayPanel } from "@/components/agenda/DayPanel";
import { PartialErrorNotice } from "@/components/agenda/PartialErrorNotice";
import { BookingsPanel } from "@/components/bookings/BookingsPanel";
import { UpcomingBookings } from "@/components/bookings/UpcomingBookings";
import { useClientList } from "@/components/shell/useClientList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAgendaData, usePrefetchAgendaRange } from "@/lib/agenda/agenda.queries";
import { isDayKey } from "@/lib/agenda/dates";
import { groupByDay, periodLabel, queryRange, step } from "@/lib/agenda/view";
import { useChileToday } from "@/lib/agenda/useChileToday";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  AGENDA_KINDS,
  AGENDA_KIND_LABEL_PLURAL,
  isAgendaKind,
  type AgendaKind,
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
  const tab = search.tab ?? "calendario";

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setSearch({ tab: v === "reservas" ? "reservas" : undefined })}
      className="contents"
    >
      {/* La configuración del link de reservas es un formulario largo: esa pestaña hace scroll. */}
      <FitPage
        scroll={tab === "reservas"}
        header={
          <PageHeader
            size="compact"
            title="Agenda"
            actions={
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
            }
          />
        }
        contentClassName="flex flex-col"
      >
        <TabsContent
          value="calendario"
          className="mt-0 flex-col data-[state=active]:flex md:min-h-0 md:flex-1"
        >
          <CalendarTab search={search} setSearch={setSearch} />
        </TabsContent>
        <TabsContent value="reservas" className="mt-0 space-y-6">
          <Panel title="Próximas reservas">
            <UpcomingBookings />
          </Panel>
          <BookingsPanel />
        </TabsContent>
      </FitPage>
    </Tabs>
  );
}

interface CalendarTabProps {
  search: AgendaSearch;
  setSearch: (patch: Partial<AgendaSearch>) => void;
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
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1">
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

      <div className="grid gap-4 md:min-h-0 md:flex-1 md:grid-rows-[minmax(0,1fr)_minmax(0,12rem)] lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)]">
        <Panel
          fill
          bodyClassName="px-2 pb-3 sm:px-4 sm:pb-4"
          title={
            <span className="inline-block first-letter:uppercase">
              {periodLabel(view, range, selected)}
            </span>
          }
          info={<AgendaLegend />}
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
            className="mb-3 shrink-0 justify-start"
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
              className={cn(
                "transition-opacity md:min-h-0 md:flex-1 md:overflow-y-auto",
                agenda.isRefreshing && "opacity-70",
              )}
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

        {view !== "lista" && (
          <Panel fill bodyClassName="pt-4 pb-3">
            <DayPanel
              day={selected}
              isToday={selected === today}
              items={itemsByDay.get(selected) ?? []}
              className="md:flex md:min-h-0 md:flex-1 md:flex-col"
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
