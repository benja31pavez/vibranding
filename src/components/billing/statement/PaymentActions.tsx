import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { generatePaymentLink } from "@/lib/flow/paymentLink.functions";
import { getPaymentDocumentUrl } from "@/lib/billing/paymentDocuments.functions";
import { paymentDocumentLabel } from "@/lib/billing/paymentDocuments";
import { errorMessage } from "./paymentWrites";
import { isOpen, type StatementPayment } from "./statementData";

export const PAY_UNAVAILABLE = "Pago en línea aún no disponible";

/** Estado de Flow para la fila: cargando, listo o no configurado. */
export type FlowState = "loading" | "ready" | "off";

const ACTION_CLS = "h-8 w-full";

function DisabledWithHint({ label, hint }: { label: string; hint: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        {/* El span recibe foco/hover: un botón deshabilitado no dispara eventos. */}
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="block rounded-app-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Button size="sm" variant="outline" disabled className={ACTION_CLS}>
              <CreditCard aria-hidden className="mr-1 h-3.5 w-3.5" />
              {label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * "Pagar" con Flow. La agencia genera (o reutiliza) el link y lo abre; el
 * cliente usa el link ya generado. Sin Flow o sin link: deshabilitado.
 */
export function PayButton({
  payment,
  flow,
  canEdit,
  onChanged,
}: {
  payment: StatementPayment;
  flow: FlowState;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const generate = useServerFn(generatePaymentLink);
  const [busy, setBusy] = useState(false);

  if (flow === "loading") {
    return (
      <Button size="sm" variant="outline" disabled aria-busy className={ACTION_CLS}>
        <Loader2 aria-hidden className="mr-1 h-3.5 w-3.5 animate-spin" />
        Pagar
      </Button>
    );
  }
  if (flow === "off") return <DisabledWithHint label="Pagar" hint={PAY_UNAVAILABLE} />;

  if (!canEdit) {
    if (!payment.payment_url) return <DisabledWithHint label="Pagar" hint={PAY_UNAVAILABLE} />;
    return (
      <Button asChild size="sm" className={ACTION_CLS}>
        <a href={payment.payment_url} target="_blank" rel="noopener noreferrer">
          <CreditCard aria-hidden className="mr-1 h-3.5 w-3.5" />
          Pagar
        </a>
      </Button>
    );
  }

  const pay = async () => {
    // La ventana se abre antes del await para que el navegador no la bloquee.
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    setBusy(true);
    try {
      const res = await generate({ data: { paymentId: payment.id } });
      if (res.state === "already_paid") {
        win?.close();
        toast.success("Flow confirma que este cobro ya está pagado");
      } else if (win) {
        win.location.href = res.paymentUrl;
      } else {
        window.location.assign(res.paymentUrl);
      }
      onChanged();
    } catch (err) {
      win?.close();
      console.error("[facturación] error al abrir el pago", err);
      toast.error(errorMessage(err, "No se pudo abrir el pago"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" onClick={() => void pay()} disabled={busy} className={ACTION_CLS}>
      {busy ? (
        <Loader2 aria-hidden className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <CreditCard aria-hidden className="mr-1 h-3.5 w-3.5" />
      )}
      Pagar
    </Button>
  );
}

/** Descarga la boleta/factura con una URL firmada de 5 minutos. */
export function DocumentButton({ payment }: { payment: StatementPayment }) {
  const sign = useServerFn(getPaymentDocumentUrl);
  const [busy, setBusy] = useState(false);
  const label = paymentDocumentLabel(payment.document_type);

  const download = async () => {
    setBusy(true);
    try {
      const { url } = await sign({ data: { paymentId: payment.id } });
      window.location.assign(url);
    } catch (err) {
      console.error("[facturación] error al descargar documento", err);
      toast.error(errorMessage(err, "No pudimos abrir el documento"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => void download()}
      disabled={busy}
      className={ACTION_CLS}
      aria-label={`Descargar ${label.toLowerCase()}`}
    >
      {busy ? (
        <Loader2 aria-hidden className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download aria-hidden className="mr-1 h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}

/** Acción principal de la fila: Pagar (abierto) o Boleta/Factura (pagado con documento). */
export function PrimaryAction(props: {
  payment: StatementPayment;
  flow: FlowState;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { payment } = props;
  if (isOpen(payment)) return <PayButton {...props} />;
  if (payment.document_path) return <DocumentButton payment={payment} />;
  return null;
}
