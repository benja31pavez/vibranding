import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ErrorState, Panel, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { useReviewAlerts } from "@/hooks/use-review-alerts";
import { formatShortDate } from "./queries";

/** Comentarios / aprobaciones de clientes sin leer (en todos los clientes). */
export function ReviewActivity() {
  const { alerts, loading, error, reload, retrying } = useReviewAlerts();
  if (error) {
    return (
      <ErrorState
        title="No pudimos cargar las revisiones de clientes"
        message={error}
        onRetry={() => void reload()}
        retrying={retrying}
      />
    );
  }
  if (loading || alerts.length === 0) return null;

  const markRead = async () => {
    const { error } = await supabase
      .from("deliverable_comments")
      .update({ read_by_agency: true })
      .in(
        "id",
        alerts.map((a) => a.id),
      );
    if (error) {
      console.error("[dashboard] no se pudo marcar como leído", error);
      toast.error("No se pudo marcar como leído. Intenta de nuevo.");
      return;
    }
    await reload();
  };

  return (
    <Panel
      icon={MessageSquare}
      title={`Revisiones de clientes (${alerts.length})`}
      actions={
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => void markRead()}>
          Marcar como leído
        </Button>
      }
    >
      <ul className="divide-y divide-border-subtle">
        {alerts.map((a) => (
          <li key={a.id} className="space-y-1 py-2 text-sm first:pt-0 last:pb-0">
            <Link
              to="/clients/$clientId/plan"
              params={{ clientId: a.client_id }}
              className="block truncate font-medium hover:underline"
            >
              {a.deliverable_title}
            </Link>
            {a.body && <p className="line-clamp-2 break-words text-muted-foreground">{a.body}</p>}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <StatusBadge status={a.kind} />
              <span>
                {a.author_name ?? "Cliente"} · {formatShortDate(a.created_at)}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
