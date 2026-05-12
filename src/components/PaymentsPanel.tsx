import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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

export function PaymentsPanel({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Payment[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ description: "", amount: "", currency: "USD", due_date: "" });

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
      currency: draft.currency || "USD",
      due_date: draft.due_date || null,
    });
    if (error) return toast.error(error.message);
    setDraft({ description: "", amount: "", currency: "USD", due_date: "" });
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

  const totals = items.reduce(
    (acc, p) => {
      if (p.status === "paid") acc.paid += Number(p.amount);
      else if (p.status === "pending" || p.status === "overdue") acc.pending += Number(p.amount);
      return acc;
    },
    { paid: 0, pending: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-surface p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Cobrado</div>
          <div className="text-3xl font-semibold mt-1">${totals.paid.toFixed(2)}</div>
        </div>
        <div className="rounded-2xl border bg-surface p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Por cobrar</div>
          <div className="text-3xl font-semibold mt-1">${totals.pending.toFixed(2)}</div>
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
            <Input type="number" step="0.01" placeholder="Monto" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            <Input className="w-24" placeholder="USD" value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} />
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
                  {p.due_date ? `Vence ${new Date(p.due_date).toLocaleDateString("es")}` : "Sin fecha"}
                  {p.paid_at && ` · Pagado ${new Date(p.paid_at).toLocaleDateString("es")}`}
                </div>
              </div>
              <div className="font-semibold tabular-nums">
                {p.currency} {Number(p.amount).toFixed(2)}
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
              <button onClick={() => remove(p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
