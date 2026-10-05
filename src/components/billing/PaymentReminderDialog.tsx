import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Copy, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
import {
  buildReminder,
  reminderMailtoHref,
  reminderWhatsappHref,
  STAGE_LABEL,
  type ReminderPayment,
} from "@/lib/billing/reminders";

interface ClientContact {
  name: string | null;
  phone: string | null;
  email: string | null;
}

/** Contacto del cliente: ficha de onboarding y, si falta el correo, el usuario del portal. */
async function loadClientContact(clientId: string): Promise<ClientContact> {
  const [intake, portalUser] = await Promise.all([
    supabase
      .from("client_intake")
      .select("contacto_nombre,contacto_telefono,contacto_email,email_facturacion")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("client_users")
      .select("email")
      .eq("client_id", clientId)
      .not("email", "is", null)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);
  if (intake.error) throw intake.error;
  if (portalUser.error) console.warn("[cobros] no se pudo leer el correo del portal", portalUser.error);
  const i = intake.data;
  return {
    name: i?.contacto_nombre?.trim() || null,
    phone: i?.contacto_telefono?.trim() || null,
    email:
      i?.email_facturacion?.trim() ||
      i?.contacto_email?.trim() ||
      portalUser.data?.[0]?.email?.trim() ||
      null,
  };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Arma el mensaje según la etapa del vencimiento. Nunca envía nada: el dueño
 * lo copia o lo abre en WhatsApp/correo y lo manda él mismo.
 */
export function PaymentReminderDialog({
  open,
  onOpenChange,
  payment,
  clientId,
  clientName,
  today,
  onReminded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: ReminderPayment;
  clientId: string;
  clientName: string;
  today: string;
  onReminded: () => void;
}) {
  const contact = useQuery({
    queryKey: ["client-contact", clientId],
    queryFn: () => loadClientContact(clientId),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const reminder = useMemo(
    () => buildReminder({ payment, clientName, contactName: contact.data?.name, today }),
    [payment, clientName, contact.data?.name, today],
  );
  // Borrador del usuario; mientras no edite, se muestra el mensaje generado.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? reminder.body;

  const waHref = reminderWhatsappHref(contact.data?.phone, text);
  const email = contact.data?.email ?? null;
  // mailHref es null si no hay correo válido.
  const mailHref = reminderMailtoHref(email, reminder.subject, text);
  const missingPhone = contact.isSuccess && !waHref;

  const copy = async () => {
    if (await copyText(text)) {
      toast.success("Mensaje copiado");
      onReminded();
    } else {
      toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-4 w-4" aria-hidden />
            Recordar pago
          </DialogTitle>
          <DialogDescription>
            {STAGE_LABEL[reminder.stage]} · {clientName}. Revisa el mensaje; nada se envía solo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`reminder-${payment.id}`}>Mensaje</Label>
          <Textarea
            id={`reminder-${payment.id}`}
            value={text}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
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
              <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={onReminded}>
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
              <a href={mailHref} onClick={onReminded}>
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
