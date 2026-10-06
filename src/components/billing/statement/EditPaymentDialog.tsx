import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getStatus } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fmtDay } from "./format";
import type { PaymentStatus, StatementPayment } from "./statementData";
import {
  NO_PERMISSION,
  STATUS_LOCKED_HINT,
  setPaymentStatus,
  toClpAmount,
  toDateInput,
  writeDenied,
} from "./paymentWrites";

/** "Pagado" no se elige a mano: solo lo marca la confirmación de Flow. */
const MANUAL_STATUSES: readonly PaymentStatus[] = ["pending", "overdue", "cancelled"];

/** Editar concepto, monto, vencimiento y (owner/admin) estado. El pago lo confirma Flow. */
export function EditPaymentDialog({
  payment,
  canChangeStatus,
  onClose,
  onSaved,
}: {
  payment: StatementPayment | null;
  canChangeStatus: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<StatementPayment | null>(payment);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(payment);
  }, [payment]);

  if (!form) return null;

  const paid = payment?.status === "paid";
  // Mismo criterio que el trigger t_payments_lock_amount: pagado o con link de Flow.
  const linkLocked = payment?.status === "paid" || Boolean(payment?.payment_url);

  const save = async () => {
    const amount = toClpAmount(form.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      return toast.error("Ingresa un monto válido en CLP");
    setSaving(true);
    // Datos del cobro: UPDATE directo (solo columnas permitidas al navegador).
    const patch = {
      description: form.description?.trim() || null,
      ...(linkLocked ? {} : { amount }),
      due_date: form.due_date || null,
    };
    const { data, error } = await supabase
      .from("payments")
      .update(patch)
      .eq("id", form.id)
      .select("id");
    if (writeDenied(error, data)) {
      setSaving(false);
      return toast.error(
        error ? `No se pudo actualizar el cobro: ${error.message}` : NO_PERMISSION,
      );
    }
    // Estado: vía RPC, solo si cambió (nunca a "pagado": eso lo hace Flow).
    const statusChanged =
      payment !== null && form.status !== payment.status && form.status !== "paid";
    if (statusChanged) {
      const statusError = await setPaymentStatus(form.id, form.status);
      if (statusError) {
        setSaving(false);
        toast.error(statusError);
        return onSaved();
      }
    }
    setSaving(false);
    toast.success("Cobro actualizado");
    onSaved();
  };

  return (
    <Dialog
      open={!!payment}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cobro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-concept" className="text-xs text-muted-foreground">
              Concepto
            </Label>
            <Input
              id="edit-concept"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-amount" className="text-xs text-muted-foreground">
              Total a pagar en CLP (con IVA)
            </Label>
            <Input
              id="edit-amount"
              type="number"
              step={1}
              min={1}
              inputMode="numeric"
              value={form.amount}
              disabled={linkLocked}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            />
          </div>
          {linkLocked && (
            <p className="text-xs text-muted-foreground">
              {payment?.status === "paid"
                ? "Este cobro ya está pagado: el monto no se puede cambiar."
                : "Este cobro tiene un link de pago de Flow: el monto no se puede cambiar."}{" "}
              Si el monto es otro, cancela este cobro y crea uno nuevo.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="edit-due" className="text-xs text-muted-foreground">
              Fecha de vencimiento
            </Label>
            <Input
              id="edit-due"
              type="date"
              value={toDateInput(form.due_date)}
              onChange={(e) => setForm({ ...form, due_date: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as PaymentStatus })}
              disabled={!canChangeStatus || paid}
            >
              <SelectTrigger aria-label="Estado del cobro">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(paid ? (["paid"] as const) : MANUAL_STATUSES).map((k) => (
                  <SelectItem key={k} value={k}>
                    {getStatus(k).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {paid ? (
              <p className="text-xs text-muted-foreground">
                {form.paid_at ? `Pagado el ${fmtDay(form.paid_at)}. ` : ""}Un pago confirmado no se
                cambia a mano.
              </p>
            ) : (
              !canChangeStatus && (
                <p className="text-xs text-muted-foreground">{STATUS_LOCKED_HINT}</p>
              )
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
