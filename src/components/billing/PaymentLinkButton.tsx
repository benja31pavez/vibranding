import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Info, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { generatePaymentLink } from "@/lib/flow/paymentLink.functions";
import { useFlowConfigured } from "@/lib/flow/config.functions";

export interface PaymentLinkTarget {
  id: string;
  status: string;
  currency: string;
  payment_url: string | null;
}

/** Solo cobros abiertos en CLP se cobran con Flow. */
function canChargeOnline(p: PaymentLinkTarget): boolean {
  return (p.status === "pending" || p.status === "overdue") && p.currency.toUpperCase() === "CLP";
}

async function copyToClipboard(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "No se pudo generar el link de pago";
}

/**
 * "Generar link de pago" (Flow) o "Copiar link" si el cobro ya tiene uno.
 * `onChanged` recarga la lista (link nuevo o pago ya confirmado).
 */
export function PaymentLinkButton({
  payment,
  onChanged,
}: {
  payment: PaymentLinkTarget;
  onChanged: () => void;
}) {
  const generate = useServerFn(generatePaymentLink);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const flow = useFlowConfigured();

  if (!canChargeOnline(payment)) return null;

  const copy = async (url: string) => {
    if (await copyToClipboard(url)) toast.success("Link de pago copiado");
    else toast.message("Copia este link de pago", { description: url });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await generate({ data: { paymentId: payment.id, email: email.trim() } });
      if (res.state === "already_paid") {
        toast.success("Flow confirma que este cobro ya está pagado");
      } else {
        await copy(res.paymentUrl);
      }
      setOpen(false);
      onChanged();
    } catch (err) {
      console.error("[payments] error al generar link de pago", err);
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (payment.payment_url) {
    const url = payment.payment_url;
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => copy(url)}>
        <Copy aria-hidden className="mr-1 h-3.5 w-3.5" /> Copiar link
      </Button>
    );
  }

  if (flow.isPending) {
    return (
      <Button type="button" size="sm" variant="outline" disabled aria-busy>
        <Loader2 aria-hidden className="mr-1 h-3.5 w-3.5 animate-spin" /> Link de pago
      </Button>
    );
  }
  // Si no se pudo consultar, se deja el botón: el servidor responde con un error claro.
  if (flow.data && !flow.data.configured) return <FlowNotConnectedNote missing={flow.data.missing} />;

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Link2 aria-hidden className="mr-1 h-3.5 w-3.5" /> Generar link de pago
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Generar link de pago</DialogTitle>
              <DialogDescription>
                Se crea una orden en Flow por el monto del cobro. El cliente puede pagar con tarjeta
                o transferencia y el cobro se marca pagado solo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor={`payer-${payment.id}`} className="text-xs text-muted-foreground">
                Email del pagador (opcional)
              </Label>
              <Input
                id={`payer-${payment.id}`}
                type="email"
                placeholder="Si lo dejas vacío, usamos el email del portal del cliente"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 aria-hidden className="mr-1 h-4 w-4 animate-spin" />}
                {busy ? "Generando…" : "Generar y copiar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Reemplaza "Generar link de pago" cuando Flow no está configurado. */
export function FlowNotConnectedNote({ missing }: { missing: string[] | null }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="text-muted-foreground">
          <Info aria-hidden className="mr-1 h-3.5 w-3.5" /> Conecta Flow para cobrar online
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 text-sm">
        <p className="font-medium">Cobro online desactivado</p>
        <p className="text-muted-foreground">
          Flow no está conectado, así que no se pueden generar links de pago. Puedes registrar el
          cobro, cobrarlo por transferencia y marcarlo como pagado. Un administrador de la
          plataforma puede conectar Flow desde la configuración del servidor.
        </p>
        {missing && missing.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Detalle para administradores: falta {missing.join(", ")}.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
