import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Calendar as CalendarIcon, CheckCircle2, Circle, Clock, TrendingUp, Heart, ShoppingBag, Sparkles, Flag, AlertCircle, Target, Gauge, CalendarClock, ListChecks, Check, X, MoreVertical, Pencil, BookmarkPlus, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

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

type TemplateData = {
  title: string;
  description: string;
  priority: Priority;
  category: Category;
  target_value: string;
  current_value: string;
  unit: string;
};

type Template = { id: string; name: string; data: TemplateData };

const PREDEFINED_TEMPLATES: Template[] = [
  {
    id: "ig-followers",
    name: "Crecimiento en Instagram",
    data: {
      title: "Llegar a X seguidores en Instagram",
      description: "Aumentar la comunidad orgánica para ampliar alcance y autoridad de marca.",
      priority: "medium", category: "growth",
      target_value: "", current_value: "", unit: "seguidores",
    },
  },
  {
    id: "engagement-rate",
    name: "Subir engagement promedio",
    data: {
      title: "Subir el engagement promedio al X%",
      description: "Mejorar la interacción por publicación con contenido más relevante y consistente.",
      priority: "medium", category: "engagement",
      target_value: "", current_value: "", unit: "%",
    },
  },
  {
    id: "social-sales",
    name: "Ventas desde redes",
    data: {
      title: "Generar X ventas desde redes sociales",
      description: "Convertir tráfico social en ventas mediante CTAs claros y promociones puntuales.",
      priority: "high", category: "sales",
      target_value: "", current_value: "", unit: "ventas",
    },
  },
  {
    id: "brand-identity",
    name: "Identidad visual completa",
    data: {
      title: "Publicar la identidad visual completa de la marca",
      description: "Definir logo, paleta, tipografías y guía de estilo coherente para todos los canales.",
      priority: "high", category: "branding",
      target_value: "", current_value: "", unit: "entregables",
    },
  },
  {
    id: "leads",
    name: "Captación de leads",
    data: {
      title: "Captar X leads cualificados este trimestre",
      description: "Generar una base de contactos cualificados desde campañas y contenido orgánico.",
      priority: "medium", category: "growth",
      target_value: "", current_value: "", unit: "leads",
    },
  },
];

const TEMPLATES_KEY = "objective_templates_v1";

function DatePicker({ value, onChange, placeholder = "Fecha", size = "md" }: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  size?: "sm" | "md";
}) {
  const date = value ? new Date(`${value}T00:00`) : undefined;
  const label = date
    ? date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" })
    : placeholder;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "font-normal justify-start gap-2",
            size === "sm" ? "h-7 px-2.5 text-xs rounded-full border-0 bg-secondary" : "h-10 w-full",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className={size === "sm" ? "w-3.5 h-3.5 shrink-0" : "w-4 h-4 shrink-0"} />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (!d) { onChange(null); return; }
            const pad = (n: number) => String(n).padStart(2, "0");
            onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        {value && (
          <div className="border-t p-2 flex justify-end">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => onChange(null)}>
              Quitar fecha
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ObjectivesList({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const emptyDraft = {
    title: "", description: "", due_date: "",
    priority: "medium" as Priority, category: "growth" as Category,
    target_value: "", current_value: "", unit: "",
  };
  const [draft, setDraft] = useState(emptyDraft);
  const [editDraft, setEditDraft] = useState(emptyDraft);

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
    setDraft(emptyDraft);
    setAdding(false);
    load();
  };

  const openEdit = (it: Row) => {
    setEditDraft({
      title: it.title,
      description: it.description ?? "",
      due_date: it.due_date ?? "",
      priority: it.priority,
      category: it.category,
      target_value: it.target_value != null ? String(it.target_value) : "",
      current_value: it.current_value != null ? String(it.current_value) : "",
      unit: it.unit ?? "",
    });
    setEditingId(it.id);
  };

  const saveEdit = async () => {
    if (!editingId || !editDraft.title.trim()) return;
    const { error } = await supabase.from("objectives").update({
      title: editDraft.title.trim(),
      description: editDraft.description.trim() || null,
      due_date: editDraft.due_date || null,
      priority: editDraft.priority,
      category: editDraft.category,
      target_value: editDraft.target_value ? Number(editDraft.target_value) : null,
      current_value: editDraft.current_value ? Number(editDraft.current_value) : null,
      unit: editDraft.unit.trim() || null,
    }).eq("id", editingId);
    if (error) return toast.error(error.message);
    setEditingId(null);
    toast.success("Objetivo actualizado");
    load();
  };

  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(TEMPLATES_KEY) : null;
      if (raw) setCustomTemplates(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  const persistTemplates = (next: Template[]) => {
    setCustomTemplates(next);
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const applyTemplate = (t: Template) => {
    setDraft({ ...emptyDraft, ...t.data, due_date: "" });
    toast.success(`Plantilla "${t.name}" aplicada`);
  };
  const saveAsTemplate = () => {
    if (!draft.title.trim()) { toast.error("Añade un título antes de guardar la plantilla"); return; }
    const name = window.prompt("Nombre para esta plantilla:", draft.title.slice(0, 40));
    if (!name?.trim()) return;
    const t: Template = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      data: {
        title: draft.title, description: draft.description,
        priority: draft.priority, category: draft.category,
        target_value: draft.target_value, current_value: draft.current_value,
        unit: draft.unit,
      },
    };
    persistTemplates([...customTemplates, t]);
    toast.success("Plantilla guardada");
  };
  const deleteTemplate = (id: string) => {
    persistTemplates(customTemplates.filter((t) => t.id !== id));
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

  // KPIs
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const total = items.length;
  const done = items.filter((x) => x.status === "done").length;
  const inProgress = items.filter((x) => x.status === "in_progress").length;
  const overdueCount = items.filter((x) => x.status !== "done" && x.due_date && x.due_date < today).length;
  const upcomingCount = items.filter((x) => x.status !== "done" && x.due_date && x.due_date >= today && x.due_date <= in7).length;
  // Global progress: average of completion% across all items (done = 100%)
  const globalPct = total === 0 ? 0 : Math.round(
    items.reduce((s, x) => {
      if (x.status === "done") return s + 100;
      if (x.target_value && x.target_value > 0) {
        return s + Math.min(100, ((x.current_value ?? 0) / x.target_value) * 100);
      }
      return s + (x.status === "in_progress" ? 50 : 0);
    }, 0) / total
  );

  // SMART validation
  type Level = "ok" | "warn" | "bad" | "empty";
  const computeRealism = (d: typeof draft): { level: Level; hint: string } => {
    if (!d.target_value || d.current_value === "" || !d.due_date) {
      return { level: "empty", hint: "Completa valores y fecha" };
    }
    const target = Number(d.target_value);
    const current = Number(d.current_value);
    if (!isFinite(target) || target <= 0) return { level: "empty", hint: "Valor objetivo inválido" };
    if (current > target) return { level: "bad", hint: "El valor actual ya supera al objetivo" };
    const days = Math.ceil((new Date(`${d.due_date}T00:00`).getTime() - Date.now()) / 86400000);
    if (days <= 0) return { level: "bad", hint: "La fecha límite ya pasó" };
    const delta = target - current;
    if (delta <= 0) return { level: "ok", hint: "Ya alcanzado" };
    const perDay = delta / days;
    // If we have a base value, evaluate required daily growth %
    if (current > 0) {
      const dailyPct = (perDay / current) * 100;
      if (dailyPct > 3) return { level: "bad", hint: `Requiere +${dailyPct.toFixed(1)}%/día · poco realista` };
      if (dailyPct > 1) return { level: "warn", hint: `Requiere +${dailyPct.toFixed(1)}%/día · ambicioso` };
      return { level: "ok", hint: `Requiere +${dailyPct.toFixed(2)}%/día · realista` };
    }
    // current = 0 → use absolute thresholds (ramp from zero is harder)
    if (delta >= 1000 && days < 90) return { level: "bad", hint: `+${Math.round(perDay)}/día desde 0 · poco realista, amplía el plazo` };
    if (delta >= 100 && days < 30) return { level: "bad", hint: `+${Math.round(perDay)}/día desde 0 · poco realista, amplía el plazo` };
    if (delta >= 500 && days < 60) return { level: "warn", hint: `+${Math.round(perDay)}/día desde 0 · ambicioso` };
    if (delta >= 50 && days < 14) return { level: "warn", hint: `+${perDay.toFixed(1)}/día desde 0 · ambicioso` };
    return { level: "ok", hint: `+${perDay < 1 ? perDay.toFixed(2) : Math.round(perDay)}/día · realista` };
  };
  const computeSmart = (d: typeof draft) => {
    const realism = computeRealism(d);
    return {
      specific: { ok: d.title.trim().length >= 10, hint: "Título claro (≥ 10 caracteres)" },
      measurable: { ok: !!d.target_value && Number(d.target_value) > 0 && d.unit.trim().length > 0, hint: "Valor objetivo + unidad" },
      achievable: { ok: realism.level === "ok" || realism.level === "warn", level: realism.level, hint: realism.hint },
      relevant: { ok: d.description.trim().length >= 10, hint: "Descripción con contexto (≥ 10 car.)" },
      timebound: { ok: !!d.due_date && d.due_date >= today, hint: "Fecha límite en el futuro" },
    };
  };
  // Detect number(s) in the title and compare with target_value
  const extractTitleNumbers = (title: string): number[] => {
    const nums: number[] = [];
    // Patterns like "10k", "1.5M", "2 mil", "3 millones"
    const re = /(\d+(?:[.,]\d+)*)\s*(k|m|mil(?:lones?)?|millones?)?/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(title)) !== null) {
      const raw = m[1];
      const suffix = (m[2] ?? "").toLowerCase();
      // Normalize: treat "." and "," as thousands separator when no decimal-looking suffix
      // Heuristic: if there's a single separator followed by exactly 3 digits → thousands
      let num: number;
      const cleaned = raw.replace(/[.,](?=\d{3}(\D|$))/g, "");
      // Remaining separator (if any) is decimal
      num = parseFloat(cleaned.replace(",", "."));
      if (!isFinite(num)) continue;
      if (suffix === "k") num *= 1_000;
      else if (suffix === "m" || suffix.startsWith("millon")) num *= 1_000_000;
      else if (suffix.startsWith("mil")) num *= 1_000;
      nums.push(num);
    }
    return nums;
  };
  const computeTitleConsistency = (d: typeof draft): { ok: boolean; message?: string; titleNum?: number } => {
    if (!d.target_value || !d.title.trim()) return { ok: true };
    const target = Number(d.target_value);
    if (!isFinite(target) || target <= 0) return { ok: true };
    const nums = extractTitleNumbers(d.title);
    if (nums.length === 0) return { ok: true };
    // Pick the largest number from title (most likely the goal mentioned)
    const titleNum = Math.max(...nums);
    // Tolerance: 5% or absolute 1 (for small numbers)
    const tolerance = Math.max(1, target * 0.05);
    if (Math.abs(titleNum - target) <= tolerance) return { ok: true, titleNum };
    const fmt = (n: number) => n.toLocaleString("es-ES");
    return {
      ok: false,
      titleNum,
      message: `El título menciona ${fmt(titleNum)}${d.unit ? " " + d.unit : ""} pero el valor objetivo es ${fmt(target)}${d.unit ? " " + d.unit : ""}. Ajusta uno para que coincidan.`,
    };
  };

  const smart = computeSmart(draft);
  const smartScore = Object.values(smart).filter((s) => s.ok).length;
  const titleConsistency = computeTitleConsistency(draft);
  const editSmart = computeSmart(editDraft);
  const editSmartScore = Object.values(editSmart).filter((s) => s.ok).length;
  const editTitleConsistency = computeTitleConsistency(editDraft);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Objetivos</h3>
        {!adding && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        )}
      </div>

      {/* KPI header */}
      {total > 0 && (
        <div className="rounded-2xl border bg-surface p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={<Target className="w-4 h-4" />} label="Completados" value={`${done}/${total}`} tone="success" />
            <Kpi icon={<Clock className="w-4 h-4" />} label="En curso" value={String(inProgress)} tone="warning" />
            <Kpi icon={<CalendarClock className="w-4 h-4" />} label="Próximos 7d" value={String(upcomingCount)} tone="default" />
            <Kpi icon={<AlertCircle className="w-4 h-4" />} label="Vencidos" value={String(overdueCount)} tone={overdueCount > 0 ? "destructive" : "default"} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Gauge className="w-3.5 h-3.5" /> Progreso global
              </span>
              <span className="font-semibold">{globalPct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full transition-all ${
                  globalPct >= 70 ? "bg-success" : globalPct >= 30 ? "bg-warning" : "bg-destructive"
                }`}
                style={{ width: `${globalPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {adding && (
        <div className="rounded-2xl border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="rounded-full">
                  <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" /> Usar plantilla
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Predefinidas</div>
                {PREDEFINED_TEMPLATES.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => applyTemplate(t)}>
                    {t.name}
                  </DropdownMenuItem>
                ))}
                {customTemplates.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Mis plantillas</div>
                    {customTemplates.map((t) => (
                      <div key={t.id} className="flex items-center group">
                        <DropdownMenuItem onClick={() => applyTemplate(t)} className="flex-1">
                          {t.name}
                        </DropdownMenuItem>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Eliminar plantilla"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs" onClick={saveAsTemplate}>
              <BookmarkPlus className="w-3.5 h-3.5 mr-1.5" /> Guardar como plantilla
            </Button>
          </div>
          <Input placeholder="Ej: Llegar a 10.000 seguidores en Instagram" value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
          <Textarea placeholder="¿Por qué importa este objetivo? Contexto, impacto esperado…" value={draft.description}
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
            <DatePicker value={draft.due_date || null} onChange={(v) => setDraft({ ...draft, due_date: v ?? "" })} placeholder="Fecha límite" />
            <Input placeholder="Unidad (seguidores, %, leads…)" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Valor actual" value={draft.current_value} onChange={(e) => setDraft({ ...draft, current_value: e.target.value })} />
            <Input type="number" placeholder="Valor objetivo" value={draft.target_value} onChange={(e) => setDraft({ ...draft, target_value: e.target.value })} />
          </div>

          {/* SMART checklist */}
          <div className="rounded-xl border bg-background/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <ListChecks className="w-3.5 h-3.5" /> Objetivo SMART
              </div>
              <span className={`text-[11px] font-semibold ${smartScore === 5 ? "text-success" : smartScore >= 3 ? "text-warning" : "text-muted-foreground"}`}>
                {smartScore}/5
              </span>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
              <SmartRow ok={smart.specific.ok} label="Específico" hint={smart.specific.hint} />
              <SmartRow ok={smart.measurable.ok} label="Medible" hint={smart.measurable.hint} />
              <SmartRow ok={smart.achievable.ok} level={smart.achievable.level} label="Alcanzable" hint={smart.achievable.hint} />
              <SmartRow ok={smart.relevant.ok} label="Relevante" hint={smart.relevant.hint} />
              <SmartRow ok={smart.timebound.ok} label="Con plazo" hint={smart.timebound.hint} />
            </ul>
            {smart.achievable.level === "bad" && (
              <div className="text-[11px] text-destructive pt-1 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Este objetivo parece poco realista en el plazo dado. Considera ampliar la fecha o bajar el valor objetivo.</span>
              </div>
            )}
            {smartScore < 5 && smart.achievable.level !== "bad" && (
              <div className="text-[11px] text-muted-foreground pt-1">
                Puedes guardar igual, pero los objetivos SMART suelen cumplirse más.
              </div>
            )}
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
              const barColor = pct === null ? "" : pct >= 70 ? "bg-success" : pct >= 30 ? "bg-warning" : "bg-destructive";

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
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              <span className="font-medium text-foreground">{it.current_value ?? 0}</span>
                              <span className="mx-1">/</span>
                              {it.target_value} {it.unit ?? ""}
                            </span>
                            <span className="font-semibold">{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <DatePicker
                          value={it.due_date}
                          onChange={(v) => update(it.id, { due_date: v })}
                          size="sm"
                        />
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary transition-colors" aria-label="Acciones">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openEdit(it)}>
                          <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => { if (confirm("¿Eliminar este objetivo?")) remove(it.id); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

      <Dialog open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar objetivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Ej: Llegar a 10.000 seguidores en Instagram" value={editDraft.title}
              onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} autoFocus />
            <Textarea placeholder="¿Por qué importa este objetivo? Contexto, impacto esperado…" value={editDraft.description}
              onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} rows={2} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Select value={editDraft.category} onValueChange={(v) => setEditDraft({ ...editDraft, category: v as Category })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(categoryMeta) as Category[]).map((k) => <SelectItem key={k} value={k}>{categoryMeta[k].label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={editDraft.priority} onValueChange={(v) => setEditDraft({ ...editDraft, priority: v as Priority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(priorityMeta) as Priority[]).map((k) => <SelectItem key={k} value={k}>Prioridad {priorityMeta[k].label}</SelectItem>)}
                </SelectContent>
              </Select>
              <DatePicker value={editDraft.due_date || null} onChange={(v) => setEditDraft({ ...editDraft, due_date: v ?? "" })} placeholder="Fecha límite" />
              <Input placeholder="Unidad (seguidores, %, leads…)" value={editDraft.unit} onChange={(e) => setEditDraft({ ...editDraft, unit: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Valor actual" value={editDraft.current_value} onChange={(e) => setEditDraft({ ...editDraft, current_value: e.target.value })} />
              <Input type="number" placeholder="Valor objetivo" value={editDraft.target_value} onChange={(e) => setEditDraft({ ...editDraft, target_value: e.target.value })} />
            </div>

            <div className="rounded-xl border bg-background/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <ListChecks className="w-3.5 h-3.5" /> Objetivo SMART
                </div>
                <span className={`text-[11px] font-semibold ${editSmartScore === 5 ? "text-success" : editSmartScore >= 3 ? "text-warning" : "text-muted-foreground"}`}>
                  {editSmartScore}/5
                </span>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
                <SmartRow ok={editSmart.specific.ok} label="Específico" hint={editSmart.specific.hint} />
                <SmartRow ok={editSmart.measurable.ok} label="Medible" hint={editSmart.measurable.hint} />
                <SmartRow ok={editSmart.achievable.ok} level={editSmart.achievable.level} label="Alcanzable" hint={editSmart.achievable.hint} />
                <SmartRow ok={editSmart.relevant.ok} label="Relevante" hint={editSmart.relevant.hint} />
                <SmartRow ok={editSmart.timebound.ok} label="Con plazo" hint={editSmart.timebound.hint} />
              </ul>
              {editSmart.achievable.level === "bad" && (
                <div className="text-[11px] text-destructive pt-1 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Este objetivo parece poco realista en el plazo dado. Considera ampliar la fecha o bajar el valor objetivo.</span>
                </div>
              )}
              {editSmartScore < 5 && editSmart.achievable.level !== "bad" && (
                <div className="text-[11px] text-muted-foreground pt-1">
                  Puedes guardar igual, pero los objetivos SMART suelen cumplirse más.
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
            <Button className="rounded-full" onClick={saveEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "default" | "success" | "warning" | "destructive" }) {
  const toneCls = {
    default: "bg-secondary text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
  }[tone];
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl grid place-items-center ${toneCls}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold leading-tight">{value}</div>
      </div>
    </div>
  );
}

function SmartRow({ ok, label, hint, level }: { ok: boolean; label: string; hint: string; level?: "ok" | "warn" | "bad" | "empty" }) {
  const effective: "ok" | "warn" | "bad" | "empty" = level ?? (ok ? "ok" : "empty");
  const styles = {
    ok: { badge: "bg-success/20 text-success", icon: <Check className="w-2.5 h-2.5" />, label: "text-foreground" },
    warn: { badge: "bg-warning/20 text-warning", icon: <AlertCircle className="w-2.5 h-2.5" />, label: "text-foreground" },
    bad: { badge: "bg-destructive/20 text-destructive", icon: <X className="w-2.5 h-2.5" />, label: "text-destructive" },
    empty: { badge: "bg-secondary text-muted-foreground", icon: <X className="w-2.5 h-2.5" />, label: "text-muted-foreground" },
  }[effective];
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 w-4 h-4 rounded-full grid place-items-center shrink-0 ${styles.badge}`}>
        {styles.icon}
      </span>
      <span>
        <span className={`font-medium ${styles.label}`}>{label}</span>
        <span className="text-muted-foreground"> — {hint}</span>
      </span>
    </li>
  );
}

