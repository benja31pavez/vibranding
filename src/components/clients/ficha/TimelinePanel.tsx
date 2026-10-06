import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { EmptyState, ErrorState, FitList, ListSkeleton, TONE_CLASSES } from "@/components/app";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useClientTimeline } from "./agencyQueries";
import { FichaCard } from "./FichaCard";
import { formatDate } from "./fichaQueries";
import {
  TIMELINE_KIND_META,
  relativeStamp,
  type TimelineEvent,
  type TimelineKind,
} from "./timeline";

const ALL = "all";
const MOBILE_PAGE_SIZE = 6;

/** Fecha completa para el tooltip (las solo-fecha, sin hora). */
function fullDate(at: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(at)
    ? formatDate(at)
    : new Date(at).toLocaleString("es-CL", { timeZone: "America/Santiago" });
}

function EventRow({ event, now }: { event: TimelineEvent; now: Date }) {
  const meta = TIMELINE_KIND_META[event.kind];
  return (
    <div className="grid grid-cols-[4.75rem_auto_minmax(0,1fr)] gap-x-2.5 py-2">
      <time
        dateTime={event.at}
        className="pt-px text-xs leading-5 text-muted-foreground tabular-nums"
        title={fullDate(event.at)}
      >
        {relativeStamp(event.at, now)}
      </time>
      <span
        aria-hidden
        className={cn("mt-1.5 h-2 w-2 rounded-full", TONE_CLASSES[meta.tone].dot)}
      />
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-semibold">{event.title}</p>
        {(event.detail || event.by) && (
          <p
            className="truncate text-xs text-muted-foreground"
            title={[event.detail, event.by && `por ${event.by}`].filter(Boolean).join(" · ")}
          >
            {event.detail}
            {event.detail && event.by && " · "}
            {event.by && `por ${event.by}`}
          </p>
        )}
      </div>
    </div>
  );
}

/** "Línea de tiempo": actividad reciente del cliente, con filtro por tipo. */
export function TimelinePanel({ clientId }: { clientId: string }) {
  const query = useClientTimeline(clientId);
  const [filter, setFilter] = useState<TimelineKind | typeof ALL>(ALL);
  const now = new Date();
  const events = useMemo(() => query.data ?? [], [query.data]);
  const kinds = useMemo(() => [...new Set(events.map((e) => e.kind))], [events]);
  const visible = filter === ALL ? events : events.filter((e) => e.kind === filter);

  return (
    <FichaCard
      title="Línea de tiempo"
      icon={History}
      fill
      actions={
        kinds.length > 1 ? (
          <Select value={filter} onValueChange={(v) => setFilter(v as TimelineKind | typeof ALL)}>
            <SelectTrigger className="h-7 w-auto gap-1 px-2 text-xs" aria-label="Filtrar eventos">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los eventos</SelectItem>
              {kinds.map((k) => (
                <SelectItem key={k} value={k}>
                  {TIMELINE_KIND_META[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
      }
    >
      {query.isLoading ? (
        <ListSkeleton rows={4} label="Cargando actividad" />
      ) : query.error ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : visible.length === 0 ? (
        <EmptyState size="compact" icon={History} title="Aún no hay actividad" />
      ) : (
        <FitList
          items={visible}
          getKey={(e) => e.id}
          label="Línea de tiempo"
          defaultPageSize={MOBILE_PAGE_SIZE}
          divided={false}
          renderItem={(e) => <EventRow event={e} now={now} />}
        />
      )}
    </FichaCard>
  );
}
