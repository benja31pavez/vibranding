import { useMemo } from "react";
import { History } from "lucide-react";
import { EmptyState, ErrorState, FitList, ListSkeleton } from "@/components/app";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { useClientTimeline } from "../agencyQueries";
import { FichaCard } from "../FichaCard";
import { EventRow } from "../TimelinePanel";
import { clientTimeline, type MonthPost } from "./clientView";

const MOBILE_PAGE_SIZE = 6;

/** "Lo que hemos hecho": la actividad que el cliente puede ver (sin propuestas ni notas). */
export function ClientTimelinePanel({ clientId }: { clientId: string }) {
  const query = useClientTimeline(clientId);
  const { ig } = useActiveClient();
  const now = new Date();
  const events = useMemo(
    () => clientTimeline(query.data ?? [], ig.posts as MonthPost[]),
    [query.data, ig.posts],
  );

  return (
    <FichaCard title="Lo que hemos hecho" icon={History} fill>
      {query.isLoading ? (
        <ListSkeleton rows={4} label="Cargando actividad" />
      ) : query.error ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : events.length === 0 ? (
        <EmptyState size="compact" icon={History} title="Aún no hay actividad" />
      ) : (
        <FitList
          items={events}
          getKey={(e) => e.id}
          label="Lo que hemos hecho"
          defaultPageSize={MOBILE_PAGE_SIZE}
          divided={false}
          renderItem={(e) => <EventRow event={e} now={now} />}
        />
      )}
    </FichaCard>
  );
}
