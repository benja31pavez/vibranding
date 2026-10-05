import { useState } from "react";
import { Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { Panel, TONE_CLASSES } from "@/components/app";
import { Button } from "@/components/ui/button";
import { useClientHealth } from "@/components/clients/health";
import { cn } from "@/lib/utils";
import { longDateLabel } from "@/lib/followups/rules";
import {
  REVIEW_GOOD_MOMENT_LABEL,
  askedRecently,
  isGoodMomentForReview,
} from "@/lib/reviews/requestReview";
import { RequestReviewDialog } from "./RequestReviewDialog";
import { useReviewAsked } from "./reviewAsked";
import { useReviewCandidates } from "./reviewData";

/** Ficha: botón "Pedir reseña" y, si corresponde, un aviso sutil de buen momento. */
export function RequestReviewPanel({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const { health } = useClientHealth(clientId);
  const candidates = useReviewCandidates();
  const { asked, today, markAsked } = useReviewAsked();

  const candidate = candidates.data?.candidates.find((c) => c.id === clientId);
  const goodMoment =
    Boolean(candidate && health) &&
    isGoodMomentForReview({
      clientStatus: candidate?.status,
      startedAt: candidate?.started_at ?? candidate?.created_at,
      healthLevel: health?.level,
      healthReasonCodes: health?.reasons.map((r) => r.code),
      hasOverduePayments: Boolean(candidates.data?.overdueClientIds.has(clientId)),
      lastAskedYmd: asked[clientId],
      today,
    });
  const lastAsked = askedRecently(asked[clientId], today) ? asked[clientId] : null;
  const name = clientName || candidate?.name || "el cliente";

  const onAsked = () => {
    if (!markAsked(clientId)) {
      toast.warning("Este navegador no permite recordar que ya pediste la reseña.");
    }
  };

  return (
    <Panel
      title="Reseñas y testimonios"
      icon={Star}
      description="Una reseña en Google o un testimonio de un cliente contento ayuda a cerrar nuevos clientes."
      actions={
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Star aria-hidden className="mr-1 h-3.5 w-3.5" /> Pedir reseña
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {goodMoment && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              TONE_CLASSES.success.badge,
            )}
          >
            <Sparkles aria-hidden className="h-3 w-3" />
            {REVIEW_GOOD_MOMENT_LABEL}
          </span>
        )}
        {lastAsked ? (
          <span className="text-xs">Pedida el {longDateLabel(lastAsked)} (registro de este navegador).</span>
        ) : !goodMoment ? (
          <span className="text-xs">
            Conviene pedirla cuando el cliente está contento y al día con sus pagos.
          </span>
        ) : null}
      </div>
      {open && (
        <RequestReviewDialog
          open={open}
          onOpenChange={setOpen}
          clientId={clientId}
          clientName={name}
          onAsked={onAsked}
        />
      )}
    </Panel>
  );
}
