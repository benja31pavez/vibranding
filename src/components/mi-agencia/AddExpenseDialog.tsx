import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { invalidateAgency } from "@/lib/agency/queries";
import { ivaOf, withIva } from "@/lib/pricing/iva";

const CATEGORIES: readonly { code: string; label: string }[] = [
  { code: "suscripciones", label: "Suscripciones (software, herramientas)" },
  { code: "servicios", label: "Servicios (internet, oficina)" },
  { code: "sueldos", label: "Sueldos y remuneraciones" },
  { code: "honorarios", label: "Honorarios de terceros" },
  { code: "marketing", label: "Marketing y publicidad" },
  { code: "infraestructura", label: "Infraestructura y hardware" },
  { code: "otros", label: "Otros" },
];

const DOCUMENT_TYPES: readonly { code: string; label: string }[] = [
  { code: "boleta", label: "Boleta" },
  { code: "factura", label: "Factura" },
  { code: "otro", label: "Sin documento" },
];

const PAYMENT_METHODS: readonly { code: string; label: string }[] = [
  { code: "tarjeta_personal", label: "Tarjeta personal" },
  { code: "tarjeta_empresa", label: "Tarjeta de la empresa" },
  { code: "transferencia", label: "Transferencia" },
  { code: "efectivo", label: "Efectivo" },
  { code: "otro", label: "Otro" },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function AddExpenseDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [concept, setConcept] = useState("");
  const [category, setCategory] = useState("suscripciones");
  const [documentType, setDocumentType] = useState("boleta");
  const [documentNumber, setDocumentNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("tarjeta_personal");
  const [date, setDate] = useState(todayIso());
  const [netInput, setNetInput] = useState("");
  const [applyIva, setApplyIva] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const netNumber = Number(netInput.replace(/[^0-9]/g, "")) || 0;
  const total = applyIva ? withIva(netNumber) : netNumber;
  const iva = applyIva ? ivaOf(netNumber) : 0;
  const net = applyIva ? netNumber : netNumber;

  const canSubmit = concept.trim().length > 0 && netNumber > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("agency_expenses").insert({
        org_id: orgId,
        expense_date: date,
        supplier: supplier.trim(),
        concept: concept.trim(),
        category,
        net_amount: net,
        iva_amount: iva,
        total_amount: total,
        currency: "CLP",
        document_type: documentType,
        document_number: documentNumber.trim(),
        payment_method: paymentMethod,
        notes: notes.trim(),
      });
      if (error) {
        if (error.code === "42501") {
          toast.error("Solo un administrador puede registrar gastos.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("Gasto registrado");
      await invalidateAgency(qc);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar gasto</DialogTitle>
          <DialogDescription>
            Registra un pago de la agencia (suscripción, servicio, honorario).
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="concept">Concepto</Label>
            <Input
              id="concept"
              value={concept}
              maxLength={200}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej.: Suscripción mensual Claude Pro"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier">Proveedor</Label>
            <Input
              id="supplier"
              value={supplier}
              maxLength={160}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Ej.: Anthropic"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Fecha</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment">Método de pago</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="payment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-type">Documento</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger id="doc-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-number">N.º de documento</Label>
            <Input
              id="doc-number"
              value={documentNumber}
              maxLength={40}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="net">Monto neto (CLP)</Label>
            <Input
              id="net"
              inputMode="numeric"
              value={netInput}
              onChange={(e) => setNetInput(e.target.value)}
              placeholder="0"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={applyIva}
                onChange={(e) => setApplyIva(e.target.checked)}
              />
              Agregar 19% de IVA al total
            </label>
            <p className="text-xs text-muted-foreground tabular-nums">
              Neto: ${formatClp(net)} · IVA: ${formatClp(iva)} · Total: ${formatClp(total)}
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? "Guardando…" : "Guardar gasto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatClp(amount: number): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
