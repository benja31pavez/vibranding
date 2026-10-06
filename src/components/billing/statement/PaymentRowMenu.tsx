import { useServerFn } from "@tanstack/react-start";
import { BellRing, Copy, FileUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generatePaymentLink } from "@/lib/flow/paymentLink.functions";
import { copyToClipboard, errorMessage } from "./paymentWrites";
import { isOpen, type StatementPayment } from "./statementData";
import type { FlowState } from "./PaymentActions";

export type RowMenuAction = "remind" | "upload" | "edit" | "delete";

/** Acciones de la agencia sobre un cobro (nunca se muestra al cliente). El pago lo confirma Flow. */
export function PaymentRowMenu({
  payment,
  flow,
  onAction,
  onChanged,
}: {
  payment: StatementPayment;
  flow: FlowState;
  onAction: (action: RowMenuAction, payment: StatementPayment) => void;
  onChanged: () => void;
}) {
  const generate = useServerFn(generatePaymentLink);
  const open = isOpen(payment);
  const concept = payment.description || "Cobro";

  const copyLink = async () => {
    try {
      const res = await generate({ data: { paymentId: payment.id } });
      if (res.state === "already_paid") {
        toast.success("Flow confirma que este cobro ya está pagado");
      } else if (await copyToClipboard(res.paymentUrl)) {
        toast.success("Link de pago copiado");
      } else {
        toast.message("Copia este link de pago", { description: res.paymentUrl });
      }
      onChanged();
    } catch (err) {
      console.error("[facturación] error al copiar link", err);
      toast.error(errorMessage(err, "No se pudo generar el link de pago"));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground"
          aria-label={`Más acciones de «${concept}»`}
        >
          <MoreHorizontal aria-hidden className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {open && (
          <>
            <DropdownMenuItem onSelect={() => onAction("remind", payment)}>
              <BellRing aria-hidden className="mr-2 h-4 w-4" />
              Recordar pago
            </DropdownMenuItem>
            <DropdownMenuItem disabled={flow !== "ready"} onSelect={() => void copyLink()}>
              <Copy aria-hidden className="mr-2 h-4 w-4" />
              Copiar link de pago
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onSelect={() => onAction("upload", payment)}>
          <FileUp aria-hidden className="mr-2 h-4 w-4" />
          {payment.document_path ? "Reemplazar boleta/factura" : "Subir boleta/factura"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("edit", payment)}>
          <Pencil aria-hidden className="mr-2 h-4 w-4" />
          Editar cobro
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-danger-strong focus:text-danger-strong"
          onSelect={() => onAction("delete", payment)}
        >
          <Trash2 aria-hidden className="mr-2 h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
