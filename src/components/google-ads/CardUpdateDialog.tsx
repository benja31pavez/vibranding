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
import { supabase } from "@/integrations/supabase/client";
import { reminderMailtoHref, reminderWhatsappHref } from "@/lib/billing/reminders";
import { copyText, loadClientContact } from "@/lib/billing/clientContact";
import { buildCardUpdateMessage, isBillingVerdict } from "@/lib/google-ads/billing";

async function loadClientName(clientId: string): Promise<string> {
  const { data, error } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data?.name ?? "";
}

/**
 * Mensaje para pedirle al cliente que actualice su tarjeta en Google Ads.
 * Nunca envía nada: el dueño lo copia o lo abre en WhatsApp/correo.
 */
export function CardUpdateDialog({
  open,
  onOpenChange,
  clientId,
  verdict,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  verdict?: string | null;
}) {
  const contact = useQuery({
    queryKey: ["client-contact", clientId],
    queryFn: () => loadClientContact(clientId),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const name = useQuery({
    queryKey: ["client-name", clientId],
    queryFn: () => loadClientName(clientId),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const clientName = name.data ?? "";
  const message = useMemo(
    () =>
      buildCardUpdateMessage({
        clientName,
        contactName: contact.data?.name,
        verdict: isBillingVerdict(verdict) ? verdict : null,
      }),
    [clientName, contact.data?.name, verdict],
  );
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? message.body;
  const waHref = reminderWhatsappHref(contact.data?.phone, text);
  const mailHref = reminderMailtoHref(contact.data?.email, message.subject, text);

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
            Pedir actualizar la tarjeta
          </DialogTitle>
          <DialogDescription>
            Google Ads{clientName ? ` · ${clientName}` : ""}. Revisa el mensaje; nada se envía solo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`card-update-${clientId}`}>Mensaje</Label>
          <Textarea
            id={`card-update-${clientId}`}
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
                ? "Este cliente no tiene teléfono ni correo en su ficha de onboarding: copia el mensaje."
                : !waHref
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
          <Button asChild={Boolean(waHref)} variant="outline" disabled={!waHref}>
            {waHref ? (
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-1 h-4 w-4" aria-hidden />
                Abrir WhatsApp
              </a>
            ) : (
              <span>
                <MessageCircle className="mr-1 inline h-4 w-4" aria-hidden />
                Abrir WhatsApp
              </span>
            )}
          </Button>
          <Button asChild={Boolean(mailHref)} variant="outline" disabled={!mailHref}>
            {mailHref ? (
              <a href={mailHref}>
                <Mail className="mr-1 h-4 w-4" aria-hidden />
                Abrir correo
              </a>
            ) : (
              <span>
                <Mail className="mr-1 inline h-4 w-4" aria-hidden />
                Abrir correo
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
