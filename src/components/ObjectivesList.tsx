import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Calendar, CheckCircle2, Circle, Clock, TrendingUp, Heart, ShoppingBag, Sparkles, Flag, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

type Status = "pending" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";
type Category = "growth" | "engagement" | "sales" | "branding" | "other";

type Row = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  due_date: string | null;
  priority: Priority;
  category: Category;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
};

const statusMeta: Record<Status, { label: string; icon: any; cls: string }> = {
  pending: { label: "Pendiente", icon: Circle, cls: "text-muted-foreground" },
  in_progress: { label: "En curso", icon: Clock, cls: "text-warning" },
  done: { label: "Completado", icon: CheckCircle2, cls: "text-success" },
};

const priorityMeta: Record<Priority, { label: string; cls: string }> = {
  high: { label: "Alta", cls: "bg-destructive/15 text-destructive" },
  medium: { label: "Media", cls: "bg-warning/15 text-warning" },
  low: { label: "Baja", cls: "bg-secondary text-muted-foreground" },
};

const categoryMeta: Record<Category, { label: string; icon: any }> = {
  growth: { label: "Crecimiento", icon: TrendingUp },
  engagement: { label: "Engagement", icon: Heart },
  sales: { label: "Ventas", icon: ShoppingBag },
  branding: { label: "Branding", icon: Sparkles },
  other: { label: "Otro", icon: Flag },
};

export function ObjectivesList({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    title: "", description: "", due_date: "",
    priority: "medium" as Priority, category: "growth" as Category,
    target_value: "", current_value: "", unit: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("objectives").select("*").eq("client_id", clientId)
      .order("sort_order").order("created_at");
    if (error) toast.error(error.message);
    setItems((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [clientId]);

  const create = async () => {
    if (!draft.title.trim()) return;
    const { error } = await supabase.from("objectives").insert({
      client_id: clientId,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      due_date: draft.due_date || null,
      priority: draft.priority,
      category: draft.category,
      target_value: draft.target_value ? Number(draft.target_value) : null,
      current_value: draft.current_value ? Number(draft.current_value) : null,
      unit: draft.unit.trim() || null,
    });
    if (error) return toast.error(error.message);
    setDraft({ title: "", description: "", due_date: "", priority: "medium", category: "growth", target_value: "", current_value: "", unit: "" });
    setAdding(false);
    load();
  };

  const update = async (id: string, patch: Partial<Row>) => {
    const { error } = await supabase.from("objectives").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("objectives").delete().eq("id", id);
    load();
  };

  // Order: high priority + nearest due_date first; done at bottom
  const sorted = [...items].sort((a, b) => {
    if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
    const pri = { high: 0, medium: 1, low: 2 };
    if (pri[a.priority] !== pri[b.priority]) return pri[a.priority] - pri[b.priority];
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Objetivos</h3>
        {!adding && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border bg-surface p-4 space-y-3">
          <Input placeholder="Ej: Llegar a 10.000 seguidores" value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
          <Textarea placeholder="Descripción (opcional)" value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as Category })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(categoryMeta) as Category[]).map((k) => <SelectItem key={k} value={k}>{categoryMeta[k].label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v as Priority })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(priorityMeta) as Priority[]).map((k) => <SelectItem key={k} value={k}>Prioridad {priorityMeta[k].label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
            <Input placeholder="Unidad (seguidores, %)" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Valor actual" value={draft.current_value} onChange={(e) => setDraft({ ...draft, current_value: e.target.value })} />
            <Input type="number" placeholder="Valor objetivo" value={draft.target_value} onChange={(e) => setDraft({ ...draft, target_value: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" className="rounded-full" onClick={create}>Guardar</Button>
          </div>
        </div>
      )}

      {loading ? <div className="text-sm text-muted-foreground">Cargando…</div>
        : sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aún no hay objetivos. Agrega uno medible para empezar.
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((it) => {
              const M = statusMeta[it.status];
              const Icon = M.icon;
              const Cat = categoryMeta[it.category].icon;
              const overdue = it.due_date && it.status !== "done" && it.due_date < new Date().toISOString().slice(0, 10);
              const pct = it.target_value && it.target_value > 0
                ? Math.min(100, Math.round(((it.current_value ?? 0) / it.target_value) * 100)) : null;

              return (
                <li key={it.id} className="rounded-2xl border bg-surface p-4 group">
                  <div className="flex items-start gap-3">
                    <button className={`mt-0.5 ${M.cls}`} title={M.label}
                      onClick={() => update(it.id, { status: it.status === "done" ? "pending" : it.status === "pending" ? "in_progress" : "done" })}>
                      <Icon className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input value={it.title}
                          onChange={(e) => setItems(items.map((x) => x.id === it.id ? { ...x, title: e.target.value } : x))}
                          onBlur={(e) => e.target.value !== it.title && update(it.id, { title: e.target.value })}
                          className="border-0 px-0 h-auto py-0 font-medium text-base shadow-none focus-visible:ring-0 flex-1 min-w-[150px]" />
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${priorityMeta[it.priority].cls}`}>
                          {priorityMeta[it.priority].label}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Cat className="w-3 h-3" /> {categoryMeta[it.category].label}
                        </span>
                        {overdue && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                            <AlertCircle className="w-3 h-3" /> Vencido
                          </span>
                        )}
                      </div>
                      <Textarea placeholder="Añadir descripción…" value={it.description ?? ""}
                        onChange={(e) => setItems(items.map((x) => x.id === it.id ? { ...x, description: e.target.value } : x))}
                        onBlur={(e) => (e.target.value || null) !== it.description && update(it.id, { description: e.target.value || null })}
                        className="border-0 px-0 py-1 min-h-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0 resize-none" rows={1} />

                      {pct !== null && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{it.current_value ?? 0} / {it.target_value} {it.unit ?? ""}</span>
                            <span className="font-medium text-foreground">{pct}%</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <input type="date" value={it.due_date ?? ""}
                            onChange={(e) => update(it.id, { due_date: e.target.value || null })}
                            className="bg-transparent outline-none" />
                        </div>
                        <Select value={it.priority} onValueChange={(v) => update(it.id, { priority: v as Priority })}>
                          <SelectTrigger className="h-7 text-xs w-auto gap-1 rounded-full border-0 bg-secondary px-2.5"><SelectValue /></SelectTrigger>
                          <SelectContent>{(Object.keys(priorityMeta) as Priority[]).map((k) => <SelectItem key={k} value={k}>{priorityMeta[k].label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={it.status} onValueChange={(v) => update(it.id, { status: v as Status })}>
                          <SelectTrigger className="h-7 text-xs w-auto gap-1 rounded-full border-0 bg-secondary px-2.5"><SelectValue /></SelectTrigger>
                          <SelectContent>{(Object.keys(statusMeta) as Status[]).map((k) => <SelectItem key={k} value={k}>{statusMeta[k].label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <button onClick={() => remove(it.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
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
