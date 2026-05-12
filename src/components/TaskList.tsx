import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Calendar, CheckCircle2, Circle, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Status = "pending" | "in_progress" | "done";
type TaskRow = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: Status;
  due_date: string | null;
  sort_order: number;
};

const statusMeta: Record<Status, { label: string; icon: any; cls: string }> = {
  pending: { label: "Pendiente", icon: Circle, cls: "text-muted-foreground" },
  in_progress: { label: "En curso", icon: Clock, cls: "text-warning" },
  done: { label: "Completado", icon: CheckCircle2, cls: "text-success" },
};

export function TaskList({
  clientId,
  table,
  title,
  emptyHint,
}: {
  clientId: string;
  table: "objectives" | "deliverables";
  title: string;
  emptyHint: string;
}) {
  const [items, setItems] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", due_date: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data ?? []) as TaskRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId, table]);

  const create = async () => {
    if (!draft.title.trim()) return;
    const { error } = await supabase.from(table).insert({
      client_id: clientId,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      due_date: draft.due_date || null,
    });
    if (error) return toast.error(error.message);
    setDraft({ title: "", description: "", due_date: "" });
    setAdding(false);
    load();
  };

  const update = async (id: string, patch: Partial<TaskRow>) => {
    const { error } = await supabase.from(table).update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        {!adding && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border bg-surface p-4 space-y-3">
          <Input
            placeholder="Título"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            autoFocus
          />
          <Textarea
            placeholder="Descripción (opcional)"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2}
          />
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="max-w-[180px]"
              value={draft.due_date}
              onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
            />
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setDraft({ title: "", description: "", due_date: "" }); }}>
              Cancelar
            </Button>
            <Button size="sm" className="rounded-full" onClick={create}>Guardar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const M = statusMeta[it.status];
            const Icon = M.icon;
            return (
              <li key={it.id} className="rounded-2xl border bg-surface p-4 group">
                <div className="flex items-start gap-3">
                  <button
                    className={`mt-0.5 ${M.cls}`}
                    onClick={() =>
                      update(it.id, {
                        status: it.status === "done" ? "pending" : it.status === "pending" ? "in_progress" : "done",
                      })
                    }
                    title={M.label}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <Input
                      value={it.title}
                      onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))}
                      onBlur={(e) => e.target.value !== it.title && update(it.id, { title: e.target.value })}
                      className="border-0 px-0 h-auto py-0 font-medium text-base shadow-none focus-visible:ring-0"
                    />
                    <Textarea
                      placeholder="Añadir descripción…"
                      value={it.description ?? ""}
                      onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, description: e.target.value } : x)))}
                      onBlur={(e) => (e.target.value || null) !== it.description && update(it.id, { description: e.target.value || null })}
                      className="border-0 px-0 py-1 min-h-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0 resize-none"
                      rows={1}
                    />
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <input
                          type="date"
                          value={it.due_date ?? ""}
                          onChange={(e) => update(it.id, { due_date: e.target.value || null })}
                          className="bg-transparent outline-none"
                        />
                      </div>
                      <Select value={it.status} onValueChange={(v) => update(it.id, { status: v as Status })}>
                        <SelectTrigger className="h-7 text-xs w-auto gap-1 rounded-full border-0 bg-secondary px-2.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(statusMeta) as Status[]).map((k) => (
                            <SelectItem key={k} value={k}>{statusMeta[k].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(it.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
