import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, Panel, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { markPostFeedbackRead, usePostFeedback } from "@/hooks/use-post-feedback";

const STATUS_BADGE: Readonly<Record<string, { status: string; label: string }>> = {
  aprobado: { status: "approved", label: "Aprobó" },
  cambios: { status: "change_request", label: "Pidió cambios" },
  rechazado: { status: "rejected", label: "Rechazó" },
  pendiente: { status: "in_review", label: "Pendiente" },
};

const CAPTION_CHARS = 60;

/**
 * Notas que los clientes dejaron en posts de Instagram desde el portal y que
 * el equipo aún no lee. Sin `clientId` muestra todos los clientes (dashboard).
 */
export function PostFeedbackPanel({ clientId }: { clientId?: string }) {
  const feedback = usePostFeedback(clientId);
  const queryClient = useQueryClient();
  const [marking, setMarking] = useState(false);

  if (feedback.isError) {
    return (
      <ErrorState
        title="No pudimos cargar las notas de clientes en posts"
        message={feedback.error instanceof Error ? feedback.error.message : undefined}
        onRetry={() => void feedback.refetch()}
        retrying={feedback.isFetching}
      />
    );
  }
  const items = feedback.data ?? [];
  if (feedback.isPending || items.length === 0) return null;

  const markRead = async () => {
    setMarking(true);
    try {
      await markPostFeedbackRead(items.map((i) => i.id));
      await queryClient.invalidateQueries({ queryKey: ["post-feedback"] });
    } catch (e) {
      console.error("[post-feedback] no se pudo marcar como leído", e);
      toast.error("No se pudo marcar como leído. Intenta de nuevo.");
    } finally {
      setMarking(false);
    }
  };

  return (
    <Panel
      tone="warning"
      icon={MessageSquareText}
      title={`Notas de clientes en posts (${items.length})`}
      actions={
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          disabled={marking}
          onClick={() => void markRead()}
        >
          Marcar como leído
        </Button>
      }
    >
      <ul className="space-y-3">
        {items.map((item) => {
          const badge = item.approvalStatus ? STATUS_BADGE[item.approvalStatus] : undefined;
          const caption = item.caption?.trim() ?? "";
          return (
            <li key={item.id} className="space-y-0.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {badge && <StatusBadge status={badge.status} label={badge.label} />}
                <Link
                  to="/clients/$clientId/instagram"
                  params={{ clientId: item.clientId }}
                  className="font-medium hover:underline"
                >
                  {clientId ? "Post" : item.clientName}
                  {caption
                    ? ` · ${caption.length > CAPTION_CHARS ? `${caption.slice(0, CAPTION_CHARS)}…` : caption}`
                    : ""}
                </Link>
                {item.noteAt && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.noteAt).toLocaleDateString("es-CL")}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-line break-words text-muted-foreground">{item.note}</p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
