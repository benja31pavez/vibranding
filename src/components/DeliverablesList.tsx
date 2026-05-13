import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Calendar, CheckCircle2, Circle, Clock, Image as ImageIcon, Film, Camera, Palette, Users, FileText, Package, Check, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Status = "pending" | "in_progress" | "done";
type DType = "post" | "reel" | "story" | "design" | "meeting" | "report" | "other";

type Checklist = { text: string; done: boolean }[];

type Row = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  due_date: string | null;
  type: DType;
  checklist: Checklist;
  sort_order: number;
};

const statusMeta: Record<Status, { label: string; icon: any; cls: string }> = {
  pending: { label: "Pendiente", icon: Circle, cls: "text-muted-foreground" },
  in_progress: { label: "En curso", icon: Clock, cls: "text-warning" },
  done: { label: "Completado", icon: CheckCircle2, cls: "text-success" },
};

const typeMeta: Record<DType, { label: string; icon: any }> = {
  post: { label: "Post", icon: ImageIcon },
  reel: { label: "Reel", icon: Film },
  story: { label: "Historia", icon: Camera },
  design: { label: "Diseño", icon: Palette },
  meeting: { label: "Reunión", icon: Users },
  report: { label: "Reporte", icon: FileText },
  other: { label: "Otro", icon: Package },
};

export function DeliverablesList({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [filterType, setFilterType] = useState<"all" | DType>("all");
  const [draft, setDraft] = useState({ title: "", description: "", due_date: "", type: "post" as DType });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("deliverables").select("*").eq("client_id", clientId)
      .order("sort_order").order("created_at");
    if (error) toast.error(error.message);
    setItems((data ?? []).map((r: any) => ({ ...r, checklist: r.checklist ?? [] })) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [clientId]);

  const create = async () => {
    if (!draft.title.trim()) return;
    const { error } = await supabase.from("deliverables").insert({
      client_id: clientId,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      due_date: draft.due_date || null,
      type: draft.type,
    });
    if (error) return toast.error(error.message);
    setDraft({ title: "", description: "", due_date: "", type: "post" });
    setAdding(false);
    load();
  };

  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("deliverables").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("deliverables").delete().eq("id", id);
    load();
  };

  const filtered = useMemo(
    () => items.filter((it) => filterType === "all" || it.type === filterType),
    [items, filterType]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Entregables</h3>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="h-8 text-xs w-auto gap-1 rounded-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {(Object.keys(typeMeta) as DType[]).map((k) => <SelectItem key={k} value={k}>{typeMeta[k].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="list" className="text-xs">Lista</TabsTrigger>
              <TabsTrigger value="kanban" className="text-xs">Kanban</TabsTrigger>
            </TabsList>
          </Tabs>
          {!adding && (
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4 mr-1" /> Agregar
            </Button>
          )}
        </div>
      </div>

      {adding && (
        <div className="rounded-2xl border bg-surface p-4 space-y-3">
          <Input placeholder="Título" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
          <Textarea placeholder="Descripción (opcional)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} />
          <div className="flex flex-wrap gap-2">
            <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as DType })}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(typeMeta) as DType[]).map((k) => <SelectItem key={k} value={k}>{typeMeta[k].label}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" className="max-w-[180px]" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" className="rounded-full" onClick={create}>Guardar</Button>
          </div>
        </div>
      )}

      {loading ? <div className="text-sm text-muted-foreground">Cargando…</div>
        : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aún no hay entregables.
          </div>
        ) : view === "list" ? (
          <ul className="space-y-2">
            {filtered.map((it) => <DeliverableCard key={it.id} it={it} update={update} remove={remove} />)}
          </ul>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["pending", "in_progress", "done"] as Status[]).map((col) => (
              <div key={col} className="rounded-2xl bg-secondary/40 p-3 space-y-2 min-h-[200px]">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground px-1">
                  <span>{statusMeta[col].label}</span>
                  <span>{filtered.filter((x) => x.status === col).length}</span>
                </div>
                {filtered.filter((x) => x.status === col).map((it) => (
                  <DeliverableCard key={it.id} it={it} update={update} remove={remove} compact />
                ))}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function DeliverableCard({ it, update, remove, compact }: { it: Row; update: (id: string, patch: any) => void; remove: (id: string) => void; compact?: boolean }) {
  const M = statusMeta[it.status];
  const Icon = M.icon;
  const T = typeMeta[it.type].icon;
  const overdue = it.due_date && it.status !== "done" && it.due_date < new Date().toISOString().slice(0, 10);
  const checklist: Checklist = it.checklist ?? [];
  const doneCount = checklist.filter((c) => c.done).length;
  const [newItem, setNewItem] = useState("");
  const [showCheck, setShowCheck] = useState(false);

  const updateChecklist = (next: Checklist) => update(it.id, { checklist: next });

  return (
    <li className="rounded-2xl border bg-surface p-4 group list-none">
      <div className="flex items-start gap-3">
        <button className={`mt-0.5 ${M.cls}`} title={M.label}
          onClick={() => update(it.id, { status: it.status === "done" ? "pending" : it.status === "pending" ? "in_progress" : "done" })}>
          <Icon className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={it.title}
              onBlur={(e) => e.target.value !== it.title && update(it.id, { title: e.target.value })}
              defaultValue={it.title}
              className="border-0 px-0 h-auto py-0 font-medium text-base shadow-none focus-visible:ring-0 flex-1 min-w-[120px]" />
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              <T className="w-3 h-3" /> {typeMeta[it.type].label}
            </span>
            {overdue && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                <AlertCircle className="w-3 h-3" /> Vencido
              </span>
            )}
          </div>

          {!compact && (
            <Textarea placeholder="Añadir descripción…" defaultValue={it.description ?? ""}
              onBlur={(e) => (e.target.value || null) !== it.description && update(it.id, { description: e.target.value || null })}
              className="border-0 px-0 py-1 min-h-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0 resize-none" rows={1} />
          )}

          {checklist.length > 0 && (
            <div className="mt-2 space-y-1">
              {checklist.map((c, i) => (
                <div key={i} className="flex items-center gap-2 group/c">
                  <button onClick={() => updateChecklist(checklist.map((x, j) => j === i ? { ...x, done: !x.done } : x))}
                    className={c.done ? "text-success" : "text-muted-foreground"}>
                    {c.done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </button>
                  <span className={`text-sm flex-1 ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.text}</span>
                  <button onClick={() => updateChecklist(checklist.filter((_, j) => j !== i))}
                    className="opacity-0 group-hover/c:opacity-100 text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showCheck && (
            <div className="flex items-center gap-2 mt-2">
              <Input autoFocus value={newItem} onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newItem.trim()) {
                    updateChecklist([...checklist, { text: newItem.trim(), done: false }]);
                    setNewItem(""); setShowCheck(false);
                  } else if (e.key === "Escape") { setShowCheck(false); setNewItem(""); }
                }}
                placeholder="Subtarea + Enter" className="h-7 text-sm" />
              <Button size="sm" variant="ghost" onClick={() => { setShowCheck(false); setNewItem(""); }}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <input type="date" value={it.due_date ?? ""}
                onChange={(e) => update(it.id, { due_date: e.target.value || null })}
                className="bg-transparent outline-none" />
            </div>
            <Select value={it.type} onValueChange={(v) => update(it.id, { type: v as DType })}>
              <SelectTrigger className="h-7 text-xs w-auto gap-1 rounded-full border-0 bg-secondary px-2.5"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(typeMeta) as DType[]).map((k) => <SelectItem key={k} value={k}>{typeMeta[k].label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={it.status} onValueChange={(v) => update(it.id, { status: v as Status })}>
              <SelectTrigger className="h-7 text-xs w-auto gap-1 rounded-full border-0 bg-secondary px-2.5"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(statusMeta) as Status[]).map((k) => <SelectItem key={k} value={k}>{statusMeta[k].label}</SelectItem>)}</SelectContent>
            </Select>
            {!showCheck && (
              <button onClick={() => setShowCheck(true)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <Check className="w-3 h-3" /> Subtarea {checklist.length > 0 && `(${doneCount}/${checklist.length})`}
              </button>
            )}
          </div>
        </div>
        <button onClick={() => remove(it.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}
