import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_CURRENCY,
  addMoney,
  currencyDecimals,
  formatMoney,
  normalizeCurrency,
  type MoneyByCurrency,
} from "@/lib/pricing/plans";

type Status = "pending" | "paid" | "overdue" | "cancelled";

interface Payment {
  id: string;
  client_id: string;
  description: string | null;
  amount: number;
  currency: string;
  status: Status;
  due_date: string | null;
  paid_at: string | null;
}

const statusCls: Record<Status, string> = {
  pending: "bg-warning/15 text-warning",
  paid: "bg-success/15 text-success",
  overdue: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};
const statusLabel: Record<Status, string> = {
  pending: "Pendiente", paid: "Pagado", overdue: "Vencido", cancelled: "Cancelado",
};

const amountStep = (currency: string) => (currencyDecimals(normalizeCurrency(currency)) === 0 ? 1 : 0.01);

type Totals = MoneyByCurrency;
const addTo = addMoney;

function TotalsValue({ totals }: { totals: Totals }) {
  const entries = Object.entries(totals).filter(([, v]) => v !== 0);
  if (entries.length === 0) return <div className="text-3xl font-semibold mt-1">{formatMoney(DEFAULT_CURRENCY, 0)}</div>;
  return (
    <div className="mt-1 space-y-0.5">
      {entries.map(([cur, v]) => (
        <div key={cur} className="text-3xl font-semibold tabular-nums">{formatMoney(cur, v)}</div>
      ))}
    </div>
  );
}

export function PaymentsPanel({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Payment[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ description: "", amount: "", currency: DEFAULT_CURRENCY, due_date: "" });
  const [editing, setEditing] = useState<Payment | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Payment[]);
  };

  useEffect(() => { load(); }, [clientId]);

  const create = async () => {
    const amount = parseFloat(draft.amount);
    if (!amount) return toast.error("Ingresa un monto");
    const { error } = await supabase.from("payments").insert({
      client_id: clientId,
      description: draft.description || null,
      amount,
      currency: normalizeCurrency(draft.currency),
      due_date: draft.due_date || null,
    });
    if (error) return toast.error(error.message);
    setDraft({ description: "", amount: "", currency: DEFAULT_CURRENCY, due_date: "" });
    setAdding(false);
    load();
  };

  const update = async (id: string, patch: Partial<Payment>) => {
    if (patch.status === "paid" && !items.find((i) => i.id === id)?.paid_at) {
      patch.paid_at = new Date().toISOString().slice(0, 10);
    }
    await supabase.from("payments").update(patch).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("payments").delete().eq("id", id);
    load();
  };

  const totals = items.reduce<{ paid: Totals; pending: Totals }>(
    (acc, p) => {
      if (p.status === "paid") return { ...acc, paid: addTo(acc.paid, p.currency, Number(p.amount)) };
      if (p.status === "pending" || p.status === "overdue") {
        return { ...acc, pending: addTo(acc.pending, p.currency, Number(p.amount)) };
      }
      return acc;
    },
    { paid: {}, pending: {} }
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-surface p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Cobrado</div>
          <TotalsValue totals={totals.paid} />
        </div>
        <div className="rounded-2xl border bg-surface p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Por cobrar</div>
          <TotalsValue totals={totals.pending} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Movimientos</h3>
        {!adding && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo cobro
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border bg-surface p-4 space-y-3">
          <Input placeholder="Concepto" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} autoFocus />
          <div className="flex gap-2">
            <Input type="number" step={amountStep(draft.currency)} placeholder="Monto (IVA incluido)" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            <Input className="w-24" placeholder={DEFAULT_CURRENCY} aria-label="Moneda" value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} />
            <Input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" className="rounded-full" onClick={create}>Guardar</Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Sin movimientos por ahora.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id} className="rounded-2xl border bg-surface p-4 flex items-center gap-4 group">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.description || "Cobro"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {p.due_date ? `Vence ${new Date(p.due_date).toLocaleDateString("es-CL")}` : "Sin fecha"}
                  {p.paid_at && ` · Pagado ${new Date(p.paid_at).toLocaleDateString("es-CL")}`}
                </div>
              </div>
              <div className="font-semibold tabular-nums">
                {formatMoney(p.currency, Number(p.amount))}
              </div>
              <Select value={p.status} onValueChange={(v) => update(p.id, { status: v as Status })}>
                <SelectTrigger className={`h-8 w-32 rounded-full border-0 text-xs font-medium ${statusCls[p.status]}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(statusLabel) as Status[]).map((k) => (
                    <SelectItem key={k} value={k}>{statusLabel[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button onClick={() => setEditing(p)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground" title="Editar">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => remove(p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" title="Eliminar">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <EditDialog
        payment={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </div>
  );
}

function EditDialog({
  payment, onClose, onSaved,
}: {
  payment: Payment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Payment | null>(payment);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(payment); }, [payment]);

  if (!form) return null;

  const save = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return toast.error("Ingresa un monto válido");
    setSaving(true);
    const patch: Partial<Payment> = {
      description: form.description?.trim() || null,
      amount,
      currency: normalizeCurrency(form.currency),
      status: form.status,
      due_date: form.due_date || null,
      paid_at: form.status === "paid" ? (form.paid_at || new Date().toISOString().slice(0, 10)) : null,
    };
    const { error } = await supabase.from("payments").update(patch).eq("id", form.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Pago actualizado");
    onSaved();
  };

  return (
    <Dialog open={!!payment} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Concepto</Label>
            <Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground">Monto</Label>
              <Input type="number" step={amountStep(form.currency)} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Moneda</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fecha de vencimiento</Label>
              <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value || null })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fecha de pago</Label>
              <Input type="date" value={form.paid_at ?? ""} onChange={(e) => setForm({ ...form, paid_at: e.target.value || null })} disabled={form.status !== "paid"} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(statusLabel) as Status[]).map((k) => (
                  <SelectItem key={k} value={k}>{statusLabel[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
