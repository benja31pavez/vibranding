import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, ClipboardCheck } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton, Panel, StatusBadge } from "@/components/app";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { formatDate, type FichaHealth } from "./fichaQueries";

const MAX_UPCOMING = 5;
const MAX_APPROVALS = 6;

const KIND_LABEL: Readonly<Record<string, string>> = {
  entregable: "Entregable",
  post_instagram: "Post",
};

interface ApprovalsProps {
  clientId: string;
  health: FichaHealth | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

/** Lo que espera visto bueno del cliente (vista approval_queue). */
export function PendingApprovalPanel({ clientId, health, loading, error, onRetry }: ApprovalsProps) {
  const items = health?.approvals ?? [];
  return (
    <Panel
      title="Pendiente de aprobación"
      icon={ClipboardCheck}
      actions={
        items.length > 0 ? (
          <Link to="/clients/$clientId/deliverables" params={{ clientId }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Ver todo <ArrowRight aria-hidden className="h-3 w-3" />
          </Link>
        ) : undefined
      }
    >
      {loading ? (
        <ListSkeleton rows={3} label="Cargando aprobaciones" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState size="compact" icon={ClipboardCheck} title="Nada esperando aprobación" description="Cuando envíes un entregable o post a revisión, aparecerá aquí." />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {items.slice(0, MAX_APPROVALS).map((item) => (
            <li key={`${item.kind}-${item.ref_id}`} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <Link
                  to={item.kind === "post_instagram" ? "/clients/$clientId/instagram" : "/clients/$clientId/deliverables"}
                  params={{ clientId }}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {item.title ?? "Sin título"}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {KIND_LABEL[item.kind ?? ""] ?? item.kind} · en revisión desde {formatDate(item.created_at)}
                </div>
              </div>
              <StatusBadge status="in_review" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Próximos posts programados de Instagram (aún no publicados). */
export function UpcomingContentPanel({ clientId }: { clientId: string }) {
  const { ig } = useActiveClient();
  const now = Date.now();
  const upcoming = ig.posts
    .filter((p) => p.scheduled_at && !p.published_at && new Date(p.scheduled_at).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
    .slice(0, MAX_UPCOMING);

  return (
    <Panel
      title="Próximo contenido"
      icon={CalendarClock}
      actions={
        <Link to="/clients/$clientId/instagram" params={{ clientId }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Ir a Instagram <ArrowRight aria-hidden className="h-3 w-3" />
        </Link>
      }
    >
      {upcoming.length === 0 ? (
        <EmptyState size="compact" icon={CalendarClock} title="No hay publicaciones programadas" description="Programa posts desde la sección Instagram." />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {upcoming.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-app-sm bg-surface-2">
                {(p.cover_url ?? p.image_url) && (
                  <img src={(p.cover_url ?? p.image_url)!} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{p.caption?.trim().slice(0, 80) || "Publicación sin texto"}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {new Date(p.scheduled_at!).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <StatusBadge status="scheduled" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
