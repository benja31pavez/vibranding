import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { ErrorState, FitPage, PageHeader, Panel } from "@/components/app";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
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

export interface ClientCalendarSearch {
  vista?: "semana" | "lista";
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
 * Calendario de UN cliente (panel del cliente): misma grilla, filtros y panel del día
 * que la Agenda, sin selector de cliente y solo con lo que el cliente puede ver.
 */
export function ClientCalendar({ clientId, clientName, search, setSearch }: ClientCalendarProps) {
  const today = useChileToday();
  const isMobile = useIsMobile();
  // La vista Lista es solo para móvil; en escritorio cae a Mes.
  const view: AgendaView = search.vista === "lista" && !isMobile ? "mes" : (search.vista ?? "mes");
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
  const setView = (v: string) => {
    if (v === "mes" || v === "semana" || v === "lista") {
      setSearch({ vista: v === "mes" ? undefined : v });
    }
  };

  return (
    <FitPage
      header={<PageHeader size="compact" title="Calendario" />}
      contentClassName="flex flex-col gap-4"
    >
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
