import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronRight, MessageSquare, MessageSquareText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PostFeedbackPanel } from "@/components/instagram/PostFeedbackPanel";
import { useReviewAlerts } from "@/hooks/use-review-alerts";
import { usePostFeedback } from "@/hooks/use-post-feedback";
import { ReviewActivity } from "./review-activity";

type Which = "reviews" | "notes";

/**
 * Avisos de una línea en "Para hacer hoy": revisiones de clientes en entregables y
 * notas en posts sin leer. Cada uno abre su detalle (con "Marcar como leído") en un panel.
 * Sin pendientes no ocupa espacio.
 */
export function ClientNotesNotice() {
  const reviews = useReviewAlerts();
  const notes = usePostFeedback();
  const [open, setOpen] = useState<Which | null>(null);
  const notesCount = notes.data?.length ?? 0;
  const showReviews = reviews.count > 0 || Boolean(reviews.error);
  const showNotes = notesCount > 0 || notes.isError;
  if (!showReviews && !showNotes) return null;

  return (
    <div className="flex shrink-0 flex-col gap-2">
      {showReviews && (
        <NoticeButton
          icon={MessageSquare}
          onClick={() => setOpen("reviews")}
          label={
            reviews.error
              ? "No pudimos cargar las revisiones de clientes"
              : `Revisiones sin leer (${reviews.count})`
          }
        />
      )}
      {showNotes && (
        <NoticeButton
          icon={MessageSquareText}
          onClick={() => setOpen("notes")}
          label={
            notes.isError
              ? "No pudimos cargar las notas en posts"
              : `Notas en posts sin leer (${notesCount})`
          }
        />
      )}
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 pb-3 pt-6 text-left">
            <SheetTitle>
              {open === "notes" ? "Notas de clientes en posts" : "Revisiones de clientes"}
            </SheetTitle>
            <SheetDescription>Comentarios que el equipo aún no lee.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {open === "notes" ? <PostFeedbackPanel tone="default" /> : <ReviewActivity />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NoticeButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-app-md border border-warning/40 bg-warning-subtle px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:border-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
