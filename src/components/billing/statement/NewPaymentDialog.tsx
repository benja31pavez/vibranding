import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/pricing/plans";
import { IVA_LABEL, breakdownFromNet, withIva } from "@/lib/pricing/iva";
import { toClpAmount } from "./paymentWrites";

const EMPTY = { description: "", amount: "", due_date: "" };

/** "Neto $X + IVA $Y = Total a pagar $Z" mientras se escribe el monto. */
function DraftTotal({ rawNet }: { rawNet: string }) {
  const net = toClpAmount(rawNet);
  if (!Number.isFinite(net) || net <= 0) return null;
  const { iva, total } = breakdownFromNet(net);
  return (
    <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
      Neto {formatMoney(net)} + IVA {IVA_LABEL} {formatMoney(iva)} ={" "}
      <span className="font-medium text-foreground">Total a pagar {formatMoney(total)}</span>
    </p>
  );
}

/** Nuevo cobro: se escribe el neto y se guarda el total con IVA (lo que cobra Flow). */
export function NewPaymentDialog({
  clientId,
  open,
  onOpenChange,
  onCreated,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const net = toClpAmount(draft.amount);
    if (!Number.isFinite(net) || net <= 0) return toast.error("Ingresa un monto neto en CLP");
    setSaving(true);
    const { error } = await supabase.from("payments").insert({
      client_id: clientId,
      description: draft.description.trim() || null,
      amount: withIva(net),
      currency: DEFAULT_CURRENCY,
      due_date: draft.due_date || null,
    });
    setSaving(false);
    if (error) return toast.error(`No se pudo crear el cobro: ${error.message}`);
    toast.success("Cobro creado");
    setDraft(EMPTY);
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nuevo cobro</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-concept" className="text-xs text-muted-foreground">
              Concepto
            </Label>
            <Input
              id="new-concept"
              placeholder="Ej.: Plan mensual de noviembre"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-amount" className="text-xs text-muted-foreground">
                Monto neto en CLP (+ IVA)
              </Label>
              <Input
                id="new-amount"
                type="number"
                step={1}
                min={1}
                inputMode="numeric"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-due" className="text-xs text-muted-foreground">
                Vencimiento
              </Label>
              <Input
                id="new-due"
                type="date"
                value={draft.due_date}
                onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
              />
            </div>
          </div>
          <DraftTotal rawNet={draft.amount} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Crear cobro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
