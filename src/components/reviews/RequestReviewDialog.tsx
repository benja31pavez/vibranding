import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Mail, MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyText, loadClientContact } from "@/lib/billing/clientContact";
import { reminderMailtoHref, reminderWhatsappHref } from "@/lib/billing/reminders";
import { SIGNATURE } from "@/lib/followups/templates";
import { GOOGLE_REVIEW_URL } from "@/lib/site";
import {
  REVIEW_FAIRNESS_NOTE,
  REVIEW_MISSING_URL_NOTICE,
  buildReviewRequest,
} from "@/lib/reviews/requestReview";

const CONTACT_STALE_MS = 5 * 60_000;

/**
 * Mensaje para pedir una reseña de Google (si hay link configurado) y, opcional,
 * un testimonio corto. Nunca envía nada: el dueño lo copia o lo abre en
 * WhatsApp/correo y lo manda él mismo.
 */
export function RequestReviewDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  onAsked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  /** Se llama al copiar o abrir WhatsApp/correo (registra el pedido por 90 días). */
  onAsked: () => void;
}) {
  const contact = useQuery({
    queryKey: ["client-contact", clientId],
    queryFn: () => loadClientContact(clientId),
    enabled: open,
    staleTime: CONTACT_STALE_MS,
  });

  const request = useMemo(
    () =>
      buildReviewRequest({
        businessName: clientName,
        contactName: contact.data?.name,
        googleReviewUrl: GOOGLE_REVIEW_URL,
      }),
    [clientName, contact.data?.name],
  );
  // Borrador del usuario; mientras no edite, se muestra el mensaje generado.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? `${request.body}\n\n${SIGNATURE}`;

  const waHref = reminderWhatsappHref(contact.data?.phone, text);
  const mailHref = reminderMailtoHref(contact.data?.email ?? null, request.subject, text);
  const missingPhone = contact.isSuccess && !waHref;

  const copy = async () => {
    if (await copyText(text)) {
      toast.success("Mensaje copiado");
      onAsked();
    } else {
      toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-4 w-4" aria-hidden />
            Pedir reseña
          </DialogTitle>
          <DialogDescription>
            {clientName}. Revisa el mensaje; nada se envía solo. Nunca ofrezcas nada a cambio de una
            reseña.
          </DialogDescription>
          <p className="text-xs text-muted-foreground">{REVIEW_FAIRNESS_NOTE}</p>
        </DialogHeader>

        {!request.includesGoogle && (
          <p
            role="status"
            className="rounded-app-md bg-surface-2 p-3 text-xs text-muted-foreground"
          >
            {REVIEW_MISSING_URL_NOTICE}. Mientras tanto, el mensaje solo pide un testimonio.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor={`review-${clientId}`}>Mensaje</Label>
          <Textarea
            id={`review-${clientId}`}
            value={text}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="text-sm"
          />
          {contact.isError ? (
            <p role="alert" className="text-xs text-danger-strong">
              No se pudo cargar el contacto del cliente. Puedes copiar el mensaje igual.
            </p>
          ) : contact.isSuccess && (missingPhone || !mailHref) ? (
            <p className="text-xs text-muted-foreground">
              {missingPhone && !mailHref
                ? "Este cliente no tiene teléfono ni correo en su ficha de onboarding: copia el mensaje."
                : missingPhone
                  ? "Sin teléfono válido en la ficha de onboarding: WhatsApp no disponible."
                  : "Sin correo en la ficha ni en el portal: correo no disponible."}
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => void copy()}>
            <Copy className="mr-1 h-4 w-4" aria-hidden />
            Copiar mensaje
          </Button>
          {waHref ? (
            <Button asChild variant="outline">
              <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={onAsked}>
                <MessageCircle className="mr-1 h-4 w-4" aria-hidden />
                Abrir WhatsApp
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <MessageCircle className="mr-1 h-4 w-4" aria-hidden />
              Abrir WhatsApp
            </Button>
          )}
          {mailHref ? (
            <Button asChild variant="outline">
              <a href={mailHref} onClick={onAsked}>
                <Mail className="mr-1 h-4 w-4" aria-hidden />
                Abrir correo
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <Mail className="mr-1 h-4 w-4" aria-hidden />
              Abrir correo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
