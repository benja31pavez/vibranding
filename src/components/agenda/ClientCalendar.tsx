import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import {
  ErrorState,
  FitPage,
  PageHeader,
  Panel,
  SectionTabs,
  type SectionTab,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  useClientAgendaData,
  usePrefetchClientAgendaRange,
} from "@/lib/agenda/clientAgenda.queries";
import { dayKeyOf } from "@/lib/agenda/dates";
import {
  AGENDA_KINDS,
  AGENDA_KIND_LABEL_PLURAL,
  isAgendaKind,
  type AgendaItem,
  type AgendaKind,
  type AgendaView,
} from "@/lib/agenda/types";
import { useChileToday } from "@/lib/agenda/useChileToday";
import { groupByDay, periodLabel, queryRange, step } from "@/lib/agenda/view";
import { isTaskLate } from "@/lib/delivery/planStages";
import { cn } from "@/lib/utils";
import { AgendaCalendar, AgendaCalendarSkeleton } from "./AgendaCalendar";
import { AgendaFilters } from "./AgendaFilters";
import { AgendaLegend } from "./AgendaLegend";
import { ClientCalendarResumen } from "./ClientCalendarResumen";
import { DayPanel } from "./DayPanel";
import { PartialErrorNotice } from "./PartialErrorNotice";
import { TASK_LATE_STATUS } from "./agendaStyles";

/** Tareas del Plan sin entregar con fecha vencida se muestran como "Atrasado", igual que su tablero. */
function withLateTasks(items: readonly AgendaItem[], today: string): AgendaItem[] {
  return items.map((it) =>
    it.kind === "tarea" &&
    it.status &&
    isTaskLate({ status: it.status, due_date: dayKeyOf(it.date, it.allDay) }, today)
      ? { ...it, status: TASK_LATE_STATUS }
      : it,
  );
}

/** Vistas del calendario propiamente tal (las tres pestañas después de Resumen). */
export type CalendarViewTab = AgendaView;
export type CalendarTab = "resumen" | CalendarViewTab;
export const CALENDAR_TABS: readonly CalendarTab[] = ["resumen", "mes", "semana", "lista"];
export function isCalendarTab(v: unknown): v is CalendarTab {
  return typeof v === "string" && (CALENDAR_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<CalendarTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "mes", label: "Mes" },
  { key: "semana", label: "Semana" },
  { key: "lista", label: "Lista" },
];

export interface ClientCalendarSearch {
  /** Subsección: resumen (por defecto), mes, semana o lista. */
  tab?: CalendarTab;
  fecha?: string;
  /** Tipos separados por coma; ausente = todos. */
  tipos?: string;
}

interface ClientCalendarProps {
  clientId: string;
  clientName: string;
  search: ClientCalendarSearch;
  setSearch: (patch: Partial<ClientCalendarSearch>) => void;
}

/**
 * Calendario de UN cliente (panel del cliente), con cuatro subsecciones: Resumen
 * (próximos 7 días con contadores), Mes, Semana y Lista. Las vistas usan la misma
 * grilla, filtros y panel del día que la Agenda, sin selector de cliente y solo con lo
 * que el cliente puede ver.
 */
export function ClientCalendar({ clientId, clientName, search, setSearch }: ClientCalendarProps) {
  const today = useChileToday();
  const tab: CalendarTab = search.tab ?? "resumen";
  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader size="compact" title="Calendario" />
      <SectionTabs
        tabs={TABS}
        value={tab}
        onChange={(next) => setSearch({ tab: next === "resumen" ? undefined : next })}
        label="Vistas del calendario"
      />
    </div>
  );
  if (tab === "resumen") {
    return (
      <FitPage header={header} contentClassName="flex flex-col gap-4">
        <ClientCalendarResumen
          clientId={clientId}
          clientName={clientName}
          today={today}
          onOpenView={(next) => setSearch({ tab: next })}
        />
      </FitPage>
    );
  }
  return (
    <ClientCalendarView
      clientId={clientId}
      clientName={clientName}
      view={tab}
      search={search}
      setSearch={setSearch}
      today={today}
      header={header}
    />
  );
}

interface ClientCalendarViewProps extends ClientCalendarProps {
  view: AgendaView;
  today: string;
  header: ReactNode;
}

/** Vistas Mes, Semana y Lista: grilla + filtros + panel del día (no en Lista). */
function ClientCalendarView({
  clientId,
  clientName,
  view,
  search,
  setSearch,
  today,
  header,
}: ClientCalendarViewProps) {
  const selected = search.fecha ?? today;
  const range = useMemo(() => queryRange(view, selected), [view, selected]);
  const nextRange = useMemo(() => queryRange(view, step(view, selected, 1)), [view, selected]);

  const scope = useMemo(() => ({ clientId, clientName }), [clientId, clientName]);
  const agenda = useClientAgendaData(range, scope);
  usePrefetchClientAgendaRange(nextRange, scope);

  const kinds = useMemo(
    (): AgendaKind[] | null => (search.tipos ? search.tipos.split(",").filter(isAgendaKind) : null),
    [search.tipos],
  );
  const items = useMemo(() => withLateTasks(agenda.items, today), [agenda.items, today]);
  const counts = useMemo(() => {
    const base = Object.fromEntries(AGENDA_KINDS.map((k) => [k, 0])) as Record<AgendaKind, number>;
    return items.reduce((acc, it) => ({ ...acc, [it.kind]: acc[it.kind] + 1 }), base);
  }, [items]);
  const visible = useMemo(
    () => (kinds ? items.filter((it) => kinds.includes(it.kind)) : items),
    [items, kinds],
  );
  const itemsByDay = useMemo(() => groupByDay(visible), [visible]);

  const selectDay = (day: string) => setSearch({ fecha: day === today ? undefined : day });

  return (
    <FitPage header={header} contentClassName="flex flex-col gap-4">
      <AgendaFilters
        kinds={kinds}
        counts={counts}
        onKindsChange={(k) => setSearch({ tipos: k ? k.join(",") : undefined })}
        onClear={() => setSearch({ tipos: undefined })}
      />

      {agenda.failed.length > 0 && !agenda.allFailed && (
        <PartialErrorNotice
          labels={agenda.failed.map((s) => AGENDA_KIND_LABEL_PLURAL[s.kind])}
          retrying={agenda.failed.some((s) => s.isFetching)}
          onRetry={agenda.refetchFailed}
        />
      )}

      <div
        className={cn(
          "grid gap-4 md:min-h-0 md:flex-1",
          view === "lista"
            ? "md:grid-rows-[minmax(0,1fr)]"
            : "md:grid-rows-[minmax(0,1fr)_minmax(0,12rem)] lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)]",
        )}
      >
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
          <p role="status" aria-live="polite" className="sr-only">
            {agenda.isRefreshing ? "Actualizando calendario…" : ""}
          </p>
          {agenda.allFailed ? (
            <ErrorState
              title="No pudimos cargar el calendario"
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
              hideClient
              className="md:flex md:min-h-0 md:flex-1 md:flex-col"
            />
          </Panel>
        )}
      </div>
    </FitPage>
  );
}
