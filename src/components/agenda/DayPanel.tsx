import { CalendarX2, ChevronRight } from "lucide-react";
import { EmptyState, FitList, StatusBadge } from "@/components/app";
import { useUserPrefs } from "@/hooks/use-user-prefs";
import { formatLongDay, formatTime } from "@/lib/agenda/dates";
import { AGENDA_KIND_LABEL, type AgendaItem } from "@/lib/agenda/types";
import { cn } from "@/lib/utils";
import { AgendaLink } from "./AgendaChip";
import { KIND_STYLE, describeItem, itemStatus, itemStyle } from "./agendaStyles";

interface DayPanelProps {
  day: string;
  isToday: boolean;
  items: readonly AgendaItem[];
  className?: string;
}

/** Detalle del día seleccionado con enlace a la pantalla de origen de cada evento. */
export function DayPanel({ day, isToday, items, className }: DayPanelProps) {
  const { timeZone, isChileTime } = useUserPrefs();
  return (
    <section aria-labelledby="agenda-day-title" aria-live="polite" className={className}>
      <h2
        id="agenda-day-title"
        className="mb-3 flex shrink-0 flex-wrap items-center gap-2 text-sm font-semibold"
      >
        <span className="inline-block first-letter:uppercase">{formatLongDay(day)}</span>
        {isToday && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            Hoy
          </span>
        )}
        <span className="text-xs font-normal text-muted-foreground">
          {items.length === 0 ? "" : `${items.length} ${items.length === 1 ? "evento" : "eventos"}`}
        </span>
      </h2>
      {!isChileTime && (
        <p className="-mt-2 mb-3 shrink-0 text-xs text-muted-foreground">
          Horas en tu zona ({timeZone.replace(/_/g, " ")}). Los días son los de Chile.
        </p>
      )}
      {items.length === 0 ? (
        <EmptyState size="compact" icon={CalendarX2} title="Nada agendado" />
      ) : (
        <FitList
          items={items}
          getKey={(item) => item.id}
          label="Eventos del día"
          gap={8}
          divided={false}
          mobileShowAll
          renderItem={(item) => <DayItem item={item} timeZone={timeZone} />}
        />
      )}
    </section>
  );
}

function DayItem({ item, timeZone }: { item: AgendaItem; timeZone: string }) {
  const Icon = KIND_STYLE[item.kind].icon;
  const status = itemStatus(item);
  return (
    <AgendaLink
      href={item.href}
      aria-label={`${describeItem(item, timeZone)}. Abrir`}
      className="group flex items-start gap-3 rounded-app-md border border-border-subtle p-2.5 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-app-sm border",
          itemStyle(item).chip,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span aria-hidden className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{AGENDA_KIND_LABEL[item.kind]}</span>
          <span>{item.allDay ? "Todo el día" : formatTime(item.date, timeZone)}</span>
        </span>
        <span className="mt-0.5 block break-words text-sm">{item.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <span className="truncate text-xs text-muted-foreground">{item.clientName}</span>
          {status && (
            <StatusBadge status={item.status ?? ""} label={status.label} tone={status.tone} />
          )}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </AgendaLink>
  );
}
