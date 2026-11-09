import { CalendarDays, CalendarRange, ListChecks, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { CompactStats, ErrorState, Panel, type CompactStat } from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  useClientAgendaData,
  usePrefetchClientAgendaRange,
} from "@/lib/agenda/clientAgenda.queries";
import { addDays, dayKeyOf, formatShortDay } from "@/lib/agenda/dates";
import {
  AGENDA_KINDS,
  AGENDA_KIND_LABEL_PLURAL,
  type AgendaItem,
  type AgendaKind,
  type AgendaRange,
} from "@/lib/agenda/types";
import { groupByDay } from "@/lib/agenda/view";
import { isTaskLate } from "@/lib/delivery/planStages";
import { cn } from "@/lib/utils";
import { AgendaCalendar, AgendaCalendarSkeleton } from "./AgendaCalendar";
import { AgendaLegend } from "./AgendaLegend";
import { PartialErrorNotice } from "./PartialErrorNotice";
import { KIND_STYLE, TASK_LATE_STATUS } from "./agendaStyles";
import type { CalendarViewTab } from "./ClientCalendar";

/** Días que abarca el resumen (hoy incluido). */
const RESUMEN_DAYS = 7;

/** Tipos con contador propio en la franja de arriba; el resto va en "Otros". */
const FEATURED_KINDS: readonly AgendaKind[] = ["publicacion", "entregable", "tarea", "reserva"];

const VIEW_LINKS: readonly {
  tab: CalendarViewTab;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    tab: "mes",
    label: "Mes",
    hint: "La grilla completa del mes, con el detalle del día.",
    icon: CalendarDays,
  },
  {
    tab: "semana",
    label: "Semana",
    hint: "Siete columnas, un día por columna.",
    icon: CalendarRange,
  },
  {
    tab: "lista",
    label: "Lista",
    hint: "Todo el mes, día por día, en una sola lista.",
    icon: ListChecks,
  },
];

function withLateTasks(items: readonly AgendaItem[], today: string): AgendaItem[] {
  return items.map((it) =>
    it.kind === "tarea" &&
    it.status &&
    isTaskLate({ status: it.status, due_date: dayKeyOf(it.date, it.allDay) }, today)
      ? { ...it, status: TASK_LATE_STATUS }
      : it,
  );
}

interface ClientCalendarResumenProps {
  clientId: string;
  clientName: string;
  today: string;
  onOpenView: (tab: CalendarViewTab) => void;
}

/**
 * Resumen del calendario del cliente: los próximos 7 días (publicaciones programadas,
 * entregas, tareas, reservas, cobros…) con contadores por tipo, la lista día por día y
 * accesos a las vistas Mes, Semana y Lista. Usa las mismas fuentes que el calendario.
 */
export function ClientCalendarResumen({
  clientId,
  clientName,
  today,
  onOpenView,
}: ClientCalendarResumenProps) {
  const range = useMemo<AgendaRange>(
    () => ({ from: today, to: addDays(today, RESUMEN_DAYS) }),
    [today],
  );
  const nextRange = useMemo<AgendaRange>(
    () => ({ from: range.to, to: addDays(range.to, RESUMEN_DAYS) }),
    [range],
  );
  const scope = useMemo(() => ({ clientId, clientName }), [clientId, clientName]);
  const agenda = useClientAgendaData(range, scope);
  usePrefetchClientAgendaRange(nextRange, scope);

  const items = useMemo(() => withLateTasks(agenda.items, today), [agenda.items, today]);
  const itemsByDay = useMemo(() => groupByDay(items), [items]);
  const counts = useMemo(() => {
    const base = Object.fromEntries(AGENDA_KINDS.map((k) => [k, 0])) as Record<AgendaKind, number>;
    return items.reduce((acc, it) => ({ ...acc, [it.kind]: acc[it.kind] + 1 }), base);
  }, [items]);
  const others = AGENDA_KINDS.filter((k) => !FEATURED_KINDS.includes(k)).reduce(
    (sum, k) => sum + counts[k],
    0,
  );

  const stats: CompactStat[] = [
    ...FEATURED_KINDS.map((k) => ({
      key: k,
      label: AGENDA_KIND_LABEL_PLURAL[k],
      value: counts[k],
      icon: KIND_STYLE[k].icon,
      loading: agenda.isLoading,
    })),
    {
      key: "otros",
      label: "Otros",
      value: others,
      hint: "Objetivos, cobros, suscripciones y contratos",
      loading: agenda.isLoading,
    },
  ];

  const periodLabel = `${formatShortDay(range.from)} – ${formatShortDay(addDays(range.to, -1))}`;

  return (
    <>
      {agenda.failed.length > 0 && !agenda.allFailed && (
        <PartialErrorNotice
          labels={agenda.failed.map((s) => AGENDA_KIND_LABEL_PLURAL[s.kind])}
          retrying={agenda.failed.some((s) => s.isFetching)}
          onRetry={agenda.refetchFailed}
        />
      )}

      <CompactStats
        items={stats}
        label={`Eventos de los próximos ${RESUMEN_DAYS} días por tipo`}
        className="shrink-0 grid-flow-row grid-cols-2 divide-x-0 sm:grid-cols-3 md:grid-flow-col md:auto-cols-fr md:divide-x"
      />

      <div className="grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_18rem] md:grid-rows-[minmax(0,1fr)]">
        <Panel
          fill
          title={`Próximos ${RESUMEN_DAYS} días`}
          description={periodLabel}
          info={<AgendaLegend />}
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
                view="lista"
                range={range}
                selected={today}
                today={today}
                itemsByDay={itemsByDay}
                onSelectDay={() => onOpenView("mes")}
                emptyTitle={`Nada agendado en los próximos ${RESUMEN_DAYS} días`}
                emptyDescription="Revisa el mes completo o programa publicaciones, entregas y reuniones desde sus secciones."
              />
            </div>
          )}
        </Panel>

        <Panel title="Otras vistas" description="Abre el calendario completo">
          <ul className="flex flex-col gap-2">
            {VIEW_LINKS.map(({ tab, label, hint, icon: Icon }) => (
              <li key={tab}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full items-start justify-start gap-3 whitespace-normal px-3 py-2.5 text-left"
                  onClick={() => onOpenView(tab)}
                >
                  <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-1" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-xs font-normal text-muted-foreground">{hint}</span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
