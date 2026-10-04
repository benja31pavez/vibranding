import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { useReviewAlerts } from "@/hooks/use-review-alerts";

/** Comentarios / aprobaciones de clientes sin leer (en todos los clientes). */
export function ReviewActivity() {
  const { alerts, loading, reload } = useReviewAlerts();
  if (loading || alerts.length === 0) return null;

  const markRead = async () => {
    const { error } = await supabase
      .from("deliverable_comments")
      .update({ read_by_agency: true })
      .in("id", alerts.map((a) => a.id));
    if (error) {
      console.error("[dashboard] no se pudo marcar como leído", error);
      toast.error("No se pudo marcar como leído. Intenta de nuevo.");
      return;
    }
    await reload();
  };

  return (
    <Panel
      tone="warning"
      icon={MessageSquare}
      title={`Revisiones de clientes (${alerts.length})`}
      actions={
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => void markRead()}>
          Marcar como leído
        </Button>
      }
    >
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-sm">
            <StatusBadge status={a.kind} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              <Link to="/clients/$clientId/plan" params={{ clientId: a.client_id }} className="font-medium hover:underline">
                {a.deliverable_title}
              </Link>
              <span className="text-muted-foreground">
                {" "}· {a.author_name ?? "Cliente"} · {new Date(a.created_at).toLocaleDateString("es-CL")}
              </span>
              {a.body && <span className="block truncate text-muted-foreground">{a.body}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
