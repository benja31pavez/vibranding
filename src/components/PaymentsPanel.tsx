import { useEffect, useRef, useState } from "react";
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
import { Plus, Trash2, Pencil, Receipt } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_CURRENCY,
  addMoney,
  currencyDecimals,
  normalizeCurrency,
  type MoneyByCurrency,
} from "@/lib/pricing/plans";
import {
  EmptyState, ErrorState, Money, StatCard, TableSkeleton, TONE_CLASSES, getStatus,
} from "@/components/app";
import { PaymentLinkButton } from "@/components/billing/PaymentLinkButton";

/** RLS hides rows instead of erroring: 0 affected rows means "not allowed". */
const NO_PERMISSION = "No tienes permisos para esta acción";
function writeDenied(error: unknown, rows: unknown[] | null): boolean {
  return Boolean(error) || !rows || rows.length === 0;
}

type Status = "pending" | "paid" | "overdue" | "cancelled";

/**
 * El estado (y paid_at/provider) solo se cambia vía la RPC set_payment_status:
 * valida permisos (owner/admin: manages_client) y transiciones en la BD.
 * Devuelve un mensaje de error para mostrar, o null si salió bien.
 */
async function setPaymentStatus(
  id: string,
  status: Status,
  paidAt?: string | null,
): Promise<string | null> {
  const { error } = await supabase.rpc("set_payment_status", {
    _payment_id: id,
    _status: status,
    ...(paidAt ? { _paid_at: paidAt } : {}),
  });
  if (!error) return null;
  if (error.code === "42501") return NO_PERMISSION;
  return `No se pudo cambiar el estado: ${error.message}`;
}

interface Payment {
  id: string;
  client_id: string;
  description: string | null;
  amount: number;
  currency: string;
  status: Status;
  due_date: string | null;
  paid_at: string | null;
  payment_url: string | null;
}

const STATUSES: readonly Status[] = ["pending", "paid", "overdue", "cancelled"];
const statusLabel = (s: Status) => getStatus(s).label;
const statusCls = (s: Status) => TONE_CLASSES[getStatus(s).tone].badge;

const amountStep = (currency: string) => (currencyDecimals(normalizeCurrency(currency)) === 0 ? 1 : 0.01);

type Totals = MoneyByCurrency;
const addTo = addMoney;

function TotalsValue({ totals }: { totals: Totals }) {
  const entries = Object.entries(totals).filter(([, v]) => v !== 0);
  if (entries.length === 0) return <Money amount={0} currency={DEFAULT_CURRENCY} />;
  return (
    <div className="space-y-0.5">
      {entries.map(([cur, v]) => (
        <Money key={cur} amount={v} currency={cur} className="block" />
      ))}
    </div>
  );
}

export function PaymentsPanel({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Payment[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ description: "", amount: "", currency: DEFAULT_CURRENCY, due_date: "" });
  const [editing, setEditing] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Contador de solicitudes: ignora respuestas viejas si llega una carga más nueva.
  const requestId = useRef(0);

  const load = async () => {
    const id = ++requestId.current;
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (id !== requestId.current) return;
    if (error) {
      console.error("[payments] error al cargar", error);
      setLoadError(error.message);
    } else {
      setLoadError(null);
      setItems((data ?? []) as Payment[]);
    }
    setLoading(false);
  };

  const retry = () => {
    setLoading(true);
    load();
  };

  useEffect(() => {
    setLoading(true);
    setItems([]);
    load();
  }, [clientId]);

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

  const changeStatus = async (id: string, status: Status) => {
    const error = await setPaymentStatus(id, status);
    if (error) toast.error(error);
    load();
  };

  const remove = async (id: string) => {
    const { data, error } = await supabase.from("payments").delete().eq("id", id).select("id");
    if (error) toast.error(`No se pudo eliminar el pago: ${error.message}`);
    else if (writeDenied(error, data)) toast.error(NO_PERMISSION);
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
        <StatCard label="Cobrado" loading={loading} value={<TotalsValue totals={totals.paid} />} />
        <StatCard label="Por cobrar" loading={loading} value={<TotalsValue totals={totals.pending} />} />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Movimientos</h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus aria-hidden className="mr-1 h-4 w-4" /> Nuevo cobro
          </Button>
        )}
      </div>

      {adding && (
        <div className="space-y-3 rounded-app-lg border border-border-subtle bg-surface p-4 shadow-app-xs">
          <Input placeholder="Concepto" aria-label="Concepto" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} autoFocus />
          <div className="flex gap-2">
            <Input type="number" step={amountStep(draft.currency)} placeholder="Monto (IVA incluido)" aria-label="Monto (IVA incluido)" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            <Input className="w-24" placeholder={DEFAULT_CURRENCY} aria-label="Moneda" value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} />
            <Input type="date" aria-label="Fecha de vencimiento" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" onClick={create}>Guardar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={3} columns={3} label="Cargando movimientos" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={retry} />
      ) : items.length === 0 ? (
        <EmptyState icon={Receipt} title="Sin movimientos por ahora." description="Registra un cobro para empezar a llevar la cuenta." />
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id} className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-app-lg border border-border-subtle bg-surface p-4 shadow-app-xs">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.description || "Cobro"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {p.due_date ? `Vence ${new Date(p.due_date).toLocaleDateString("es-CL")}` : "Sin fecha"}
                  {p.paid_at && ` · Pagado ${new Date(p.paid_at).toLocaleDateString("es-CL")}`}
                </div>
              </div>
              <Money amount={Number(p.amount)} currency={p.currency} className="font-semibold" />
              <PaymentLinkButton payment={p} onChanged={load} />
              <Select value={p.status} onValueChange={(v) => changeStatus(p.id, v as Status)}>
                <SelectTrigger aria-label="Estado del pago" className={`h-8 w-32 rounded-full border-0 text-xs font-medium focus:ring-2 focus:ring-ring focus:ring-offset-1 ${statusCls(p.status)}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((k) => (
                    <SelectItem key={k} value={k}>{statusLabel(k)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button type="button" onClick={() => setEditing(p)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 rounded-app-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground hover:text-foreground" aria-label="Editar pago">
                <Pencil aria-hidden className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => remove(p.id)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 rounded-app-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground hover:text-danger" aria-label="Eliminar pago">
                <Trash2 aria-hidden className="h-4 w-4" />
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

  // Con un link de Flow vigente, el monto y la moneda quedan fijos: Flow cobraría
  // el monto original y el pago no podría registrarse contra el cobro editado.
  // (La BD también lo impide: trigger t_payments_lock_amount.)
  // Mismo criterio que el trigger t_payments_lock_amount: pagado o con link de Flow.
  const linkLocked = payment?.status === "paid" || Boolean(payment?.payment_url);

  const save = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return toast.error("Ingresa un monto válido");
    setSaving(true);
    // Datos del cobro: UPDATE directo (solo columnas permitidas al navegador).
    const patch: Partial<Payment> = {
      description: form.description?.trim() || null,
      ...(linkLocked ? {} : { amount, currency: normalizeCurrency(form.currency) }),
      due_date: form.due_date || null,
    };
    const { data, error } = await supabase.from("payments").update(patch).eq("id", form.id).select("id");
    if (writeDenied(error, data)) {
      setSaving(false);
      return toast.error(error ? `No se pudo actualizar el pago: ${error.message}` : NO_PERMISSION);
    }
    // Estado / fecha de pago: vía RPC, solo si cambiaron.
    const statusChanged = payment !== null && form.status !== payment.status;
    const paidAtChanged =
      form.status === "paid" && payment !== null && (form.paid_at || null) !== payment.paid_at;
    if (statusChanged || paidAtChanged) {
      const statusError = await setPaymentStatus(
        form.id,
        form.status,
        form.status === "paid" ? form.paid_at : null,
      );
      if (statusError) {
        setSaving(false);
        toast.error(statusError);
        return onSaved();
      }
    }
    setSaving(false);
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
              <Input type="number" step={amountStep(form.currency)} value={form.amount} disabled={linkLocked} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Moneda</Label>
              <Input value={form.currency} disabled={linkLocked} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </div>
          </div>
          {linkLocked && (
            <p className="text-xs text-muted-foreground">
              {payment?.status === "paid"
                ? "Este cobro ya está pagado: el monto y la moneda no se pueden cambiar."
                : "Este cobro tiene un link de pago de Flow: el monto y la moneda no se pueden cambiar."}{" "}
              Si el monto es otro, cancela este cobro y crea uno nuevo.
            </p>
          )}
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
                {STATUSES.map((k) => (
                  <SelectItem key={k} value={k}>{statusLabel(k)}</SelectItem>
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
