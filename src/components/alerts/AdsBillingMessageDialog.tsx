import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, CreditCard, Mail, MessageCircle } from "lucide-react";
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
import { buildAdsBillingMessage } from "@/lib/ads-billing/messages";
import type { MetaBillingReason } from "@/lib/ads-billing/metaStatus";
import { reminderMailtoHref, reminderWhatsappHref } from "@/lib/billing/reminders";
import { copyText, loadClientContact } from "@/lib/billing/clientContact";

/**
 * Mensaje listo para el cliente cuando Meta reporta un problema de pago de
 * pauta. Nunca envía nada: el dueño lo copia o lo abre en WhatsApp/correo.
 */
export function AdsBillingMessageDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  reason,
  adAccountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  reason: MetaBillingReason;
  adAccountId: string | null;
}) {
  const contact = useQuery({
    queryKey: ["client-contact", clientId],
    queryFn: () => loadClientContact(clientId),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const message = useMemo(
    () =>
      buildAdsBillingMessage({ clientName, contactName: contact.data?.name, reason, adAccountId }),
    [clientName, contact.data?.name, reason, adAccountId],
  );
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? message.body;
  const waHref = reminderWhatsappHref(contact.data?.phone, text);
  const mailHref = reminderMailtoHref(contact.data?.email ?? null, message.subject, text);
  const textId = `ads-billing-msg-${clientId}`;

  const copy = async () => {
    if (await copyText(text)) toast.success("Mensaje copiado");
    else toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" aria-hidden />
            Pago de pauta en Meta
          </DialogTitle>
          <DialogDescription>
            {clientName}. Revisa el mensaje; nada se envía solo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={textId}>Mensaje</Label>
          <Textarea
            id={textId}
            value={text}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="text-sm"
          />
          {contact.isError ? (
            <p role="alert" className="text-xs text-danger-strong">
              No se pudo cargar el contacto del cliente. Puedes copiar el mensaje igual.
            </p>
          ) : contact.isSuccess && (!waHref || !mailHref) ? (
            <p className="text-xs text-muted-foreground">
              {!waHref && !mailHref
                ? "Este cliente no tiene teléfono ni correo en su ficha: copia el mensaje."
                : !waHref
                  ? "Sin teléfono válido en la ficha: WhatsApp no disponible."
                  : "Sin correo en la ficha ni en el portal: correo no disponible."}
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => void copy()}>
            <Copy className="mr-1 h-4 w-4" aria-hidden />
            Copiar mensaje
          </Button>
          <LinkButton href={waHref} external icon={MessageCircle} label="Abrir WhatsApp" />
          <LinkButton href={mailHref} icon={Mail} label="Abrir correo" />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkButton({
  href,
  external,
  icon: Icon,
  label,
}: {
  href: string | null;
  external?: boolean;
  icon: typeof Mail;
  label: string;
}) {
  if (!href) {
    return (
      <Button variant="outline" disabled>
        <Icon className="mr-1 h-4 w-4" aria-hidden />
        {label}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline">
      <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        <Icon className="mr-1 h-4 w-4" aria-hidden />
        {label}
      </a>
    </Button>
  );
}
