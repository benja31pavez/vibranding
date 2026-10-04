import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calendar, User, CheckCircle2, Circle, Clock } from "lucide-react";
import { toast } from "sonner";
import { writeFailed } from "@/lib/writeCheck";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Status = "pending" | "in_progress" | "done";

type Task = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  status: Status;
  due_date: string | null;
  sort_order: number;
};

const statusMeta: Record<Status, { label: string; icon: any; cls: string; badge: string }> = {
  pending: { label: "Por hacer", icon: Circle, cls: "text-muted-foreground", badge: "bg-secondary text-secondary-foreground" },
  in_progress: { label: "En curso", icon: Clock, cls: "text-warning", badge: "bg-warning/15 text-warning-foreground" },
  done: { label: "Completada", icon: CheckCircle2, cls: "text-success", badge: "bg-success/15 text-success" },
};

function fmtDate(d: string | null) {
  if (!d) return "Sin fecha";
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

function isLate(t: Task) {
  if (!t.due_date || t.status === "done") return false;
  return new Date(`${t.due_date}T23:59:59`).getTime() < Date.now();
}

export function ClientTasksList({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", assignee: "", due_date: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("client_tasks" as any) as any)
      .select("*")
      .eq("client_id", clientId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Task[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const create = async () => {
    if (!draft.title.trim()) return toast.error("Ponle un nombre a la tarea");
    const { error } = await (supabase.from("client_tasks" as any) as any).insert({
      client_id: clientId,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      assignee: draft.assignee.trim() || null,
      due_date: draft.due_date || null,
    });
    if (error) return toast.error(error.message);
    setDraft({ title: "", description: "", assignee: "", due_date: "" });
    setAdding(false);
    load();
  };

  const update = async (id: string, patch: Partial<Task>) => {
    const res = await (supabase.from("client_tasks" as any) as any).update(patch).eq("id", id).select("id");
    if (writeFailed(res)) return;
    load();
  };

  const remove = async (id: string) => {
    const title = items.find((t) => t.id === id)?.title;
    if (!confirm(`¿Eliminar ${title ? `la tarea «${title}»` : "esta tarea"}?`)) return;
    const res = await (supabase.from("client_tasks" as any) as any).delete().eq("id", id).select("id");
    if (writeFailed(res, "No se pudo eliminar la tarea")) return;
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tareas</h3>
          <p className="text-sm text-muted-foreground">
            Qué hay que hacer, quién es responsable y para cuándo.
          </p>
        </div>
        {!adding && (
          <Button size="sm" className="rounded-full" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nueva tarea
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border bg-surface p-4 space-y-3">
          <Input
            placeholder="¿Qué hay que hacer?"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            autoFocus
          />
          <Textarea
            placeholder="Detalle de la tarea (opcional)"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Responsable"
              className="max-w-[200px]"
              value={draft.assignee}
              onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}
            />
            <Input
              type="date"
              className="max-w-[180px]"
              value={draft.due_date}
              onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
            />
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setAdding(false); setDraft({ title: "", description: "", assignee: "", due_date: "" }); }}
            >
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
          Todavía no hay tareas. Crea la primera para repartir el trabajo.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((t) => {
            const M = statusMeta[t.status];
            const Icon = M.icon;
            return (
              <li key={t.id} className="group rounded-2xl border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <button
                    className={`mt-0.5 ${M.cls}`}
                    title={M.label}
                    onClick={() =>
                      update(t.id, {
                        status: t.status === "done" ? "pending" : t.status === "pending" ? "in_progress" : "done",
                      })
                    }
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <Input
                      value={t.title}
                      onChange={(e) => setItems(items.map((x) => (x.id === t.id ? { ...x, title: e.target.value } : x)))}
                      onBlur={(e) => e.target.value !== t.title && update(t.id, { title: e.target.value })}
                      className={`border-0 px-0 h-auto py-0 font-medium text-base shadow-none focus-visible:ring-0 ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}
                    />
                    <Textarea
                      placeholder="¿A qué corresponde esta tarea?"
                      value={t.description ?? ""}
                      onChange={(e) => setItems(items.map((x) => (x.id === t.id ? { ...x, description: e.target.value } : x)))}
                      onBlur={(e) => (e.target.value || null) !== t.description && update(t.id, { description: e.target.value || null })}
                      className="border-0 px-0 py-1 min-h-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0 resize-none"
                      rows={1}
                    />
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <div className="flex items-center gap-1.5 rounded-full bg-accent/10 text-accent px-2.5 py-1 text-xs">
                        <User className="w-3.5 h-3.5" />
                        <input
                          placeholder="Responsable"
                          value={t.assignee ?? ""}
                          onChange={(e) => setItems(items.map((x) => (x.id === t.id ? { ...x, assignee: e.target.value } : x)))}
                          onBlur={(e) => (e.target.value || null) !== t.assignee && update(t.id, { assignee: e.target.value || null })}
                          className="bg-transparent outline-none w-24 placeholder:text-accent/60"
                        />
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${isLate(t) ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}`}>
                        <Calendar className="w-3.5 h-3.5" />
                        <input
                          type="date"
                          value={t.due_date ?? ""}
                          onChange={(e) => update(t.id, { due_date: e.target.value || null })}
                          className="bg-transparent outline-none"
                        />
                      </div>
                      {isLate(t) && (
                        <Badge variant="destructive" className="h-6 text-[10px]">Atrasada</Badge>
                      )}
                      <Select value={t.status} onValueChange={(v) => update(t.id, { status: v as Status })}>
                        <SelectTrigger className={`h-7 text-xs w-auto gap-1 rounded-full border-0 px-2.5 ${M.badge}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(statusMeta) as Status[]).map((k) => (
                            <SelectItem key={k} value={k}>{statusMeta[k].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">{fmtDate(t.due_date)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(t.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    title="Eliminar tarea"
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
