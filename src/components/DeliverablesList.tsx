import { useEffect, useMemo, useRef, useState } from "react";
import { chileToday } from "@/lib/dates/chile";
import { writeFailed } from "@/lib/writeCheck";
import { ErrorState } from "@/components/app";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Calendar, CheckCircle2, Circle, Clock, Image as ImageIcon, Film, Camera, Palette, Users, FileText, Package, Check, X, AlertCircle, Folder, FolderPlus, ChevronDown, ChevronRight, Pencil, Minus, GripVertical, Upload, Paperclip, Download, Loader2, Sparkles, MessageSquare, ThumbsUp, RotateCcw, Send, Eye, Link2, Gauge, Megaphone, Globe } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { invalidateApprovalQueue } from "@/hooks/use-approval-queue";
import { uploadClientMedia } from "@/lib/uploadMedia";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Status = "pending" | "in_progress" | "in_review" | "done";
type DType = "post" | "reel" | "story" | "design" | "meeting" | "report" | "other";

type Checklist = { text: string; done: boolean }[];

type CommentRow = {
  id: string;
  deliverable_id: string;
  author: string;
  author_role: "agency" | "client" | "guest";
  author_name: string | null;
  read_by_agency: boolean;
  kind: "comment" | "approval" | "change_request";
  body: string;
  created_at: string;
};

type Row = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  due_date: string | null;
  type: DType;
  checklist: Checklist;
  checklist_enabled: boolean;
  sort_order: number;
  folder_id: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at?: string;
  client_id?: string;
};

type FolderRow = { id: string; name: string; sort_order: number };

/** Default set built from the six service stages, offered when a client has none. */
const STARTER_STAGES: { title: string; type: DType; description: string }[] = [
  { title: "Branding", type: "design", description: "Identidad visual, paleta y aplicaciones." },
  { title: "Optimización", type: "report", description: "Optimización del perfil y de la presencia actual." },
  { title: "Contenido", type: "post", description: "Plan de contenido y primeras piezas." },
  { title: "Ads", type: "report", description: "Estructura de campañas y creativos." },
  { title: "Landing Page", type: "design", description: "Página de captación y textos." },
  { title: "Chatbot", type: "other", description: "Flujos de respuesta automática en WhatsApp." },
];

/**
 * Etapas sugeridas según el plan contratado (client_billing.plan_key).
 * "Chatbot" solo aplica si el cliente tiene WhatsApp conectado.
 */
const PLAN_STAGE_TITLES: Record<string, readonly string[]> = {
  "marca-web": ["Branding", "Optimización", "Landing Page"],
  contenido: ["Optimización", "Contenido"],
  crecimiento: ["Optimización", "Contenido", "Ads", "Landing Page"],
};

function suggestedStages(planKey: string | null, hasWhatsapp: boolean) {
  const titles = (planKey && PLAN_STAGE_TITLES[planKey]) || STARTER_STAGES.map((s) => s.title).filter((t) => t !== "Chatbot");
  const withChatbot = hasWhatsapp ? [...titles, "Chatbot"] : titles;
  return STARTER_STAGES.filter((s) => withChatbot.includes(s.title));
}

const STAGE_ORDER = STARTER_STAGES.map((stage) => stage.title.toLocaleLowerCase("es"));

function stageRank(title: string) {
  const normalized = title.trim().toLocaleLowerCase("es");
  const index = STAGE_ORDER.indexOf(normalized);
  return index === -1 ? STAGE_ORDER.length : index;
}

function stageIcon(title: string) {
  const normalized = title.trim().toLocaleLowerCase("es");
  if (normalized === "branding") return Palette;
  if (normalized === "optimización" || normalized === "optimizacion") return Gauge;
  if (normalized === "contenido") return ImageIcon;
  if (normalized === "ads") return Megaphone;
  if (normalized === "landing page") return Globe;
  if (normalized === "chatbot") return MessageSquare;
  return Package;
}

/** Un color propio por etapa, para que el plan no se vea gris. */
function stageAccent(title: string) {
  const normalized = title.trim().toLocaleLowerCase("es");
  if (normalized === "branding") return { chip: "bg-chart-5/15 text-chart-5", bar: "bg-chart-5" };
  if (normalized === "optimización" || normalized === "optimizacion") return { chip: "bg-chart-2/15 text-chart-2", bar: "bg-chart-2" };
  if (normalized === "contenido") return { chip: "bg-chart-1/15 text-chart-1", bar: "bg-chart-1" };
  if (normalized === "ads") return { chip: "bg-chart-3/20 text-chart-3", bar: "bg-chart-3" };
  if (normalized === "landing page") return { chip: "bg-chart-4/15 text-chart-4", bar: "bg-chart-4" };
  if (normalized === "chatbot") return { chip: "bg-success/15 text-success", bar: "bg-success" };
  return { chip: "bg-secondary text-secondary-foreground", bar: "bg-primary" };
}


const statusMeta: Record<Status, { label: string; icon: any; cls: string }> = {
  pending: { label: "Pendiente", icon: Circle, cls: "text-muted-foreground" },
  in_progress: { label: "En curso", icon: Clock, cls: "text-warning" },
  in_review: { label: "En revisión cliente", icon: Eye, cls: "text-primary" },
  done: { label: "Completado", icon: CheckCircle2, cls: "text-success" },
};

const nextStatus: Record<Status, Status> = {
  pending: "in_progress",
  in_progress: "in_review",
  in_review: "done",
  done: "pending",
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
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Row[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  const [view, setView] = useState<"list" | "timeline">("list");
  const [filterType, setFilterType] = useState<"all" | DType>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [seeding, setSeeding] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { caps } = useClientCapabilities(clientId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(true);
  const [draft, setDraft] = useState({ title: "", description: "", due_date: "", type: "post" as DType, folder_id: "" as string });

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const [{ data: dItems, error }, { data: dFolders, error: foldersError }] = await Promise.all([
      supabase.from("deliverables").select("*").eq("client_id", clientId).order("sort_order").order("created_at"),
      supabase.from("deliverable_folders").select("*").eq("client_id", clientId).order("sort_order").order("created_at"),
    ]);
    if (error || foldersError) {
      setLoadError((error ?? foldersError)!.message);
      setLoading(false);
      return;
    }
    // Las etapas sugeridas se crean solo con el botón "Crear etapas sugeridas", nunca al cargar.
    const nextItems = dItems ?? [];
    setItems(nextItems.map((r: any) => ({ ...r, checklist: r.checklist ?? [] })) as Row[]);
    setFolders((dFolders ?? []) as FolderRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [clientId]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !items.some((item) => item.id === selectedId)) {
      const first = [...items].sort((a, b) => stageRank(a.title) - stageRank(b.title) || a.sort_order - b.sort_order)[0];
      setSelectedId(first?.id ?? null);
    }
  }, [items, selectedId]);

  const seedStarter = async () => {
    setSeeding(true);
    const { data: billing, error: billingError } = await supabase
      .from("client_billing")
      .select("plan_key")
      .eq("client_id", clientId)
      .maybeSingle();
    if (billingError) {
      setSeeding(false);
      return toast.error(`No se pudo leer el plan del cliente: ${billingError.message}`);
    }
    const stages = suggestedStages(billing?.plan_key ?? null, caps.has_whatsapp);
    const { error } = await supabase.from("deliverables").insert(
      stages.map((s, i) => ({
        client_id: clientId,
        title: s.title,
        description: s.description,
        type: s.type,
        sort_order: i,
      })),
    );
    setSeeding(false);
    if (error) return toast.error(error.message);
    toast.success("Etapas sugeridas creadas");
    load();
  };


  const create = async () => {
    if (!draft.title.trim()) return;
    const { error } = await supabase.from("deliverables").insert({
      client_id: clientId,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      due_date: draft.due_date || null,
      type: draft.type,
      folder_id: draft.folder_id || null,
    });
    if (error) return toast.error(error.message);
    setDraft({ title: "", description: "", due_date: "", type: "post", folder_id: "" });
    setAdding(false);
    load();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState<string | "root" | null>(null);

  const inferType = (mime: string | undefined): DType => {
    if (!mime) return "other";
    if (mime === "application/pdf") return "report";
    if (mime.startsWith("image/")) return "design";
    if (mime.startsWith("video/")) return "reel";
    return "other";
  };

  const uploadFiles = async (files: FileList | File[], folderId: string | null) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      for (const file of arr) {
        try {
          const url = await uploadClientMedia(file, clientId);
          const { error } = await supabase.from("deliverables").insert({
            client_id: clientId,
            title: file.name.replace(/\.[^.]+$/, ""),
            type: inferType(file.type),
            folder_id: folderId,
            file_url: url,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || null,
          });
          if (error) toast.error(`${file.name}: ${error.message}`);
        } catch (e: any) {
          toast.error(`${file.name}: ${e.message ?? "Error al subir"}`);
        }
      }
      toast.success(arr.length === 1 ? "Archivo subido" : `${arr.length} archivos subidos`);
      load();
    } finally {
      setUploading(false);
    }
  };
  const createFolder = async () => {
    if (!folderDraft.trim()) return;
    const { error } = await supabase.from("deliverable_folders").insert({
      client_id: clientId,
      name: folderDraft.trim(),
      sort_order: folders.length,
    });
    if (error) return toast.error(error.message);
    setFolderDraft("");
    setAddingFolder(false);
    load();
  };

  const renameFolder = async (id: string, name: string) => {
    const { error } = await supabase.from("deliverable_folders").update({ name }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const removeFolder = async (id: string) => {
    if (!confirm("¿Eliminar carpeta? Los entregables se mantendrán sin carpeta.")) return;
    const { error } = await supabase.from("deliverable_folders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const rootItems = items.filter((it) => !it.folder_id || !folders.find((f) => f.id === it.folder_id));
    const entries = [
      ...folders.map((f) => ({ kind: "folder" as const, id: `f-${f.id}`, raw: f as { id: string; sort_order: number } })),
      ...rootItems.map((it) => ({ kind: "item" as const, id: `i-${it.id}`, raw: it as { id: string; sort_order: number } })),
    ].sort((a, b) => a.raw.sort_order - b.raw.sort_order);
    const oldIdx = entries.findIndex((x) => x.id === active.id);
    const newIdx = entries.findIndex((x) => x.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(entries, oldIdx, newIdx);

    // Optimistic update
    setFolders(folders.map((f) => ({ ...f, sort_order: reordered.findIndex((x) => x.kind === "folder" && x.raw.id === f.id) })).sort((a, b) => a.sort_order - b.sort_order));
    setItems((prev) => prev.map((it) => {
      const idx = reordered.findIndex((x) => x.kind === "item" && x.raw.id === it.id);
      return idx >= 0 ? { ...it, sort_order: idx } : it;
    }));

    const updates = reordered.map((entry, idx) =>
      entry.kind === "folder"
        ? supabase.from("deliverable_folders").update({ sort_order: idx }).eq("id", entry.raw.id)
        : supabase.from("deliverables").update({ sort_order: idx }).eq("id", entry.raw.id),
    );
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error);
    if (err?.error) { toast.error(err.error.message); load(); }
  };

  const reorderItems = async (folderId: string | null, activeId: string, overId: string) => {
    const groupItems = items
      .filter((x) => (x.folder_id ?? null) === folderId)
      .sort((a, b) => a.sort_order - b.sort_order);
    const oldIdx = groupItems.findIndex((x) => x.id === activeId);
    const newIdx = groupItems.findIndex((x) => x.id === overId);
    if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
    const reordered = arrayMove(groupItems, oldIdx, newIdx);
    setItems((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      reordered.forEach((it, idx) => { map.set(it.id, { ...map.get(it.id)!, sort_order: idx }); });
      return Array.from(map.values());
    });
    const results = await Promise.all(
      reordered.map((it, idx) => supabase.from("deliverables").update({ sort_order: idx }).eq("id", it.id))
    );
    const err = results.find((r) => r.error);
    if (err?.error) { toast.error(err.error.message); load(); }
  };

  const update = async (id: string, patch: any): Promise<boolean> => {
    const res = await supabase.from("deliverables").update(patch).eq("id", id).select("id");
    if (writeFailed(res)) return false;
    load();
    // Estado o título pueden cambiar la bandeja de aprobaciones y su badge.
    invalidateApprovalQueue(queryClient);
    return true;
  };

  const remove = async (id: string) => {
    const title = items.find((x) => x.id === id)?.title;
    if (!confirm(`¿Eliminar ${title ? `«${title}»` : "este entregable"}? No se puede deshacer.`)) return;
    const res = await supabase.from("deliverables").delete().eq("id", id).select("id");
    if (writeFailed(res, "No se pudo eliminar")) return;
    load();
    invalidateApprovalQueue(queryClient);
  };

  const filtered = useMemo(
    () => items.filter((it) => filterType === "all" || it.type === filterType),
    [items, filterType]
  );

  const grouped = useMemo(() => {
    const map = new Map<string | null, Row[]>();
    map.set(null, []);
    folders.forEach((f) => map.set(f.id, []));
    filtered.forEach((it) => {
      const key = it.folder_id && folders.find((f) => f.id === it.folder_id) ? it.folder_id : null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    });
    return map;
  }, [filtered, folders]);

  const orderedStages = useMemo(
    () => [...items].sort((a, b) => stageRank(a.title) - stageRank(b.title) || a.sort_order - b.sort_order),
    [items],
  );
  const selectedStage = orderedStages.find((item) => item.id === selectedId) ?? orderedStages[0];

  const selectStage = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  return (
    <div
      className={`space-y-3 rounded-2xl transition-colors ${dragOver === "root" ? "outline-dashed outline-2 outline-primary/60 bg-primary/5 p-2 -m-2" : ""}`}
      onDragOver={(e) => { if (Array.from(e.dataTransfer.types).includes("Files")) { e.preventDefault(); setDragOver("root"); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(null); }}
      onDrop={(e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          setDragOver(null);
          uploadFiles(e.dataTransfer.files, null);
        }
      }}
    >
      <h3 className="text-lg font-semibold">Etapas</h3>

      {loadError ? (
        <ErrorState title="No pudimos cargar las etapas" message={loadError} onRetry={() => void load()} retrying={loading} />
      ) : loading ? <div className="text-sm text-muted-foreground">Cargando…</div>
        : items.length === 0 && folders.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center space-y-3">
            <div className="text-sm text-muted-foreground">
              Aún no hay etapas. Puedes crear las sugeridas según el plan del cliente.
            </div>
            <Button size="sm" className="rounded-full" disabled={seeding} onClick={seedStarter}>
              {seeding ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              Crear etapas sugeridas
            </Button>
          </div>
        ) : (
          <StageGridView
            items={orderedStages}
            selectedId={selectedStage?.id ?? null}
            onSelect={selectStage}
          />
        )}

      {!loading && items.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          {view === "timeline" && <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="h-8 text-xs w-auto gap-1 rounded-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {(Object.keys(typeMeta) as DType[]).map((k) => <SelectItem key={k} value={k}>{typeMeta[k].label}</SelectItem>)}
            </SelectContent>
          </Select>}
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="list" className="text-xs">Lista</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs">Cronograma</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAddingFolder(true)}>
            <FolderPlus className="w-4 h-4 mr-1" /> Carpeta
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            {uploading ? "Subiendo…" : "Subir"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files, null);
              e.target.value = "";
            }}
          />
          {!adding && (
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4 mr-1" /> Agregar
            </Button>
          )}
        </div>
      )}

      {addingFolder && (
        <div className="rounded-2xl border bg-surface p-3 flex items-center gap-2">
          <Folder className="w-4 h-4 text-muted-foreground" />
          <Input autoFocus placeholder="Nombre de la carpeta" value={folderDraft}
            onChange={(e) => setFolderDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") { setAddingFolder(false); setFolderDraft(""); } }} />
          <Button variant="ghost" size="sm" onClick={() => { setAddingFolder(false); setFolderDraft(""); }}>Cancelar</Button>
          <Button size="sm" className="rounded-full" onClick={createFolder}>Crear</Button>
        </div>
      )}

      {adding && (
        <div className="rounded-2xl border bg-surface p-4 space-y-3">
          <Input placeholder="Título" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
          <Textarea placeholder="Descripción (opcional)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} />
          <div className="flex flex-wrap gap-2">
            <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as DType })}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(typeMeta) as DType[]).map((k) => <SelectItem key={k} value={k}>{typeMeta[k].label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={draft.folder_id || "none"} onValueChange={(v) => setDraft({ ...draft, folder_id: v === "none" ? "" : v })}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Carpeta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin carpeta</SelectItem>
                {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" className="max-w-[180px]" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" className="rounded-full" onClick={create}>Guardar</Button>
          </div>
        </div>
      )}

      {!loading && items.length > 0 && (view === "timeline" ? (
        <TimelineView items={filtered} update={update} />
      ) : selectedStage ? (
        <section id={`stage-detail-${selectedStage.id}`} aria-label={`Detalle de ${selectedStage.title}`} className="border-t pt-6">
          <button
            type="button"
            aria-expanded={detailOpen}
            aria-controls={`stage-detail-content-${selectedStage.id}`}
            onClick={() => setDetailOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-4 rounded-md py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Detalle de etapa</p>
              <h3 className="mt-1 text-xl font-semibold">{selectedStage.title}</h3>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${detailOpen ? "rotate-180" : ""}`} />
          </button>
          {detailOpen && (
            <div id={`stage-detail-content-${selectedStage.id}`} className="mt-4">
              {selectedStage.file_url
                ? <MediaTile it={selectedStage} update={update} remove={remove} />
                : <DeliverableCard it={selectedStage} folders={folders} update={update} remove={remove} />}
            </div>
          )}
        </section>
      ) : null)}
    </div>
  );
}

function StageGridView({ items, selectedId, onSelect }: {
  items: Row[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = stageIcon(item.title);
          const accent = stageAccent(item.title);
          const checklist = item.checklist ?? [];
          const done = checklist.filter((entry) => entry.done).length;
          const active = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-expanded={active}
              aria-controls={`stage-detail-${item.id}`}
              onClick={() => onSelect(item.id)}
              className={`group min-h-28 rounded-lg border bg-surface p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none ${active ? "border-accent ring-2 ring-accent/15" : "border-border"}`}
            >
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${active ? "bg-primary text-primary-foreground" : accent.chip}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-semibold">{item.title}</h4>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                    {item.description || "Sin descripción todavía."}
                  </p>
                </div>
              </div>
              {item.checklist_enabled && checklist.length > 0 && (
                <div className="mt-3 flex items-center gap-2 pl-13 text-xs text-muted-foreground">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${accent.bar} transition-all`} style={{ width: `${(done / checklist.length) * 100}%` }} />
                  </div>
                  <span>{done}/{checklist.length}</span>
                </div>
              )}
            </button>
          );
        })}
    </div>
  );
}

type DragHandle = { attributes: any; listeners: any };

function SortableWrapper({ id, children }: { id: string; children: (handle: DragHandle) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return <div ref={setNodeRef} style={style}>{children({ attributes, listeners })}</div>;
}

function FolderSection({ folder, count, collapsed, onToggle, onRename, onDelete, children, dragHandle, onDropFiles, isDragOver, onDragOver, onDragLeave }: {
  folder: FolderRow; count: number; collapsed: boolean; onToggle: () => void;
  onRename: (name: string) => void; onDelete: () => void; children: React.ReactNode; dragHandle?: DragHandle;
  onDropFiles?: (files: FileList) => void; isDragOver?: boolean; onDragOver?: () => void; onDragLeave?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  return (
    <div
      className={`rounded-2xl border bg-surface/60 p-3 space-y-2 transition-colors ${isDragOver ? "border-primary bg-primary/5" : ""}`}
      onDragOver={(e) => { if (onDropFiles && Array.from(e.dataTransfer.types).includes("Files")) { e.preventDefault(); e.stopPropagation(); onDragOver?.(); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) onDragLeave?.(); }}
      onDrop={(e) => {
        if (onDropFiles && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          onDropFiles(e.dataTransfer.files);
          onDragLeave?.();
        }
      }}
    >
      <div className="flex items-center gap-2 group">
        {dragHandle && (
          <button {...dragHandle.attributes} {...dragHandle.listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none" aria-label="Reordenar">
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <Folder className="w-4 h-4 text-muted-foreground" />
        {editing ? (
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onBlur={() => { setEditing(false); if (name.trim() && name !== folder.name) onRename(name.trim()); else setName(folder.name); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setName(folder.name); setEditing(false); } }}
            className="h-7 text-sm font-medium max-w-[280px]" />
        ) : (
          <button onClick={onToggle} className="font-medium text-sm flex-1 text-left">{folder.name}</button>
        )}
        <span className="text-xs text-muted-foreground">{count}</span>
        <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {!collapsed && <div className="pl-6">{children}</div>}
    </div>
  );
}

function DeliverableCard({ it, folders, update, remove, compact, dragHandle }: { it: Row; folders: FolderRow[]; update: (id: string, patch: any) => Promise<boolean>; remove: (id: string) => void; compact?: boolean; dragHandle?: DragHandle }) {
  const M = statusMeta[it.status];
  const Icon = M.icon;
  const T = typeMeta[it.type].icon;
  const overdue = it.due_date && it.status !== "done" && it.due_date < chileToday();
  const checklist: Checklist = it.checklist ?? [];
  const doneCount = checklist.filter((c) => c.done).length;
  const checklistOn = it.checklist_enabled ?? false;
  const [newItem, setNewItem] = useState("");
  const [showCheck, setShowCheck] = useState(false);

  const updateChecklist = (next: Checklist) => update(it.id, { checklist: next });

  return (
    <li className="rounded-2xl border bg-surface p-4 group list-none">
      <div className="flex items-start gap-3">
        {dragHandle && (
          <button
            {...dragHandle.attributes}
            {...dragHandle.listeners}
            className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none opacity-0 group-hover:opacity-100"
            aria-label="Reordenar"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <button className={`mt-0.5 ${M.cls}`} title={M.label}
          onClick={() => update(it.id, { status: nextStatus[it.status] })}>
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

          {it.file_url && (
            <FilePreview
              fileUrl={it.file_url}
              fileName={it.file_name}
              fileSize={it.file_size}
              mimeType={it.mime_type}
              compact={compact}
              onRename={(name) => update(it.id, { file_name: name })}
            />
          )}

          {!compact && (
            <Textarea placeholder="Añadir descripción…" defaultValue={it.description ?? ""}
              onBlur={(e) => (e.target.value || null) !== it.description && update(it.id, { description: e.target.value || null })}
              className="border-0 px-0 py-1 min-h-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0 resize-none" rows={1} />
          )}

          {checklistOn && checklist.length > 0 && (
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

          {checklistOn && showCheck && (
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
            <Select value={it.folder_id ?? "none"} onValueChange={(v) => update(it.id, { folder_id: v === "none" ? null : v })}>
              <SelectTrigger className="h-7 text-xs w-auto gap-1 rounded-full border-0 bg-secondary px-2.5">
                <Folder className="w-3 h-3" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin carpeta</SelectItem>
                {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {checklistOn ? (
              !showCheck && (
                <button onClick={() => setShowCheck(true)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> Subtarea {checklist.length > 0 && `(${doneCount}/${checklist.length})`}
                </button>
              )
            ) : (
              <button
                onClick={() => update(it.id, { checklist_enabled: true })}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                title="Activar checklist en este entregable"
              >
                <Check className="w-3 h-3" /> Usar checklist
              </button>
            )}
            {checklistOn && (
              <button
                onClick={() => update(it.id, { checklist_enabled: false })}
                className="text-xs text-muted-foreground/70 hover:text-foreground"
                title="Ocultar checklist"
              >
                Ocultar checklist
              </button>
            )}
          </div>
          {!compact && <ReviewPanel it={it} update={update} />}
        </div>
        <button onClick={() => remove(it.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}


function FilePreview({ fileUrl, fileName, fileSize, mimeType, compact, onRename }: {
  fileUrl: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  compact?: boolean;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(fileName ?? "");
  const isImage = mimeType?.startsWith("image/");
  const isVideo = mimeType?.startsWith("video/");
  const isPdf = mimeType === "application/pdf" || (fileName?.toLowerCase().endsWith(".pdf") ?? false);
  const sizeLabel =
    fileSize != null
      ? fileSize < 1024 * 1024
        ? `${Math.round(fileSize / 1024)} KB`
        : `${(fileSize / 1024 / 1024).toFixed(1)} MB`
      : null;

  const commitRename = () => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== fileName) onRename(trimmed);
    else setName(fileName ?? "");
  };

  return (
    <div className="mt-2 rounded-xl border bg-secondary/30 overflow-hidden">
      {!compact && (isImage || isVideo || isPdf) && (
        <div className="bg-background/60 border-b">
          {isImage && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={fileUrl}
                alt={fileName ?? ""}
                className="w-full max-h-72 object-contain bg-muted"
                loading="lazy"
              />
            </a>
          )}
          {isVideo && (
            <video
              src={fileUrl}
              controls
              preload="metadata"
              className="w-full max-h-80 bg-black"
            />
          )}
          {isPdf && !isImage && !isVideo && (
            <object data={`${fileUrl}#toolbar=0&navpanes=0`} type="application/pdf" className="w-full h-72 bg-background">
              <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline p-3 block">
                Abrir PDF
              </a>
            </object>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        {isImage ? (
          <ImageIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : isVideo ? (
          <Film className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : isPdf ? (
          <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
        {editing ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") { setName(fileName ?? ""); setEditing(false); }
            }}
            className="h-7 text-xs flex-1"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Editar nombre"
            className="text-xs flex-1 text-left truncate hover:text-foreground"
          >
            {fileName ?? "Archivo"}
          </button>
        )}
        {sizeLabel && <span className="text-[11px] text-muted-foreground flex-shrink-0">{sizeLabel}</span>}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
          title="Renombrar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          download={fileName ?? undefined}
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
          title="Descargar"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

function MediaTile({ it, update, remove, dragHandle }: { it: Row; update: (id: string, patch: any) => Promise<boolean>; remove: (id: string) => void; dragHandle?: DragHandle }) {
  const [open, setOpen] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const isImage = it.mime_type?.startsWith("image/");
  const isVideo = it.mime_type?.startsWith("video/");
  const isPdf = it.mime_type === "application/pdf" || (it.file_name?.toLowerCase().endsWith(".pdf") ?? false);
  const sizeLabel = it.file_size != null
    ? it.file_size < 1024 * 1024
      ? `${Math.round(it.file_size / 1024)} KB`
      : `${(it.file_size / 1024 / 1024).toFixed(1)} MB`
    : null;
  const dateLabel = it.created_at ? new Date(it.created_at).toLocaleDateString("es-CL") : null;

  return (
    <>
      <div className="group relative inline-block align-top">
        {dragHandle && (
          <button
            {...dragHandle.attributes}
            {...dragHandle.listeners}
            className="absolute -top-2 -left-2 z-10 p-1 rounded-full bg-background border shadow-sm cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none opacity-0 group-hover:opacity-100"
            aria-label="Reordenar"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block rounded-xl overflow-hidden border bg-secondary/30 hover:ring-2 hover:ring-primary/40 transition-all"
          title={it.title}
        >
          {isImage && it.file_url && (
            <img src={it.file_url} alt={it.title} className="block w-48 h-48 object-cover" loading="lazy" />
          )}
          {isVideo && it.file_url && (
            <video src={it.file_url} className="block w-48 h-48 object-cover bg-black" preload="metadata" muted />
          )}
          {isPdf && (
            <div className="w-48 h-48 flex flex-col items-center justify-center gap-2 bg-muted">
              <FileText className="w-10 h-10 text-muted-foreground" />
              <span className="text-xs text-muted-foreground px-2 text-center truncate max-w-full">{it.file_name ?? "PDF"}</span>
            </div>
          )}
          {!isImage && !isVideo && !isPdf && (
            <div className="w-48 h-48 flex items-center justify-center bg-muted">
              <Paperclip className="w-10 h-10 text-muted-foreground" />
            </div>
          )}
        </button>
        <button
          onClick={() => remove(it.id)}
          className="absolute -top-2 -right-2 z-10 p-1 rounded-full bg-background border shadow-sm text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
          aria-label="Eliminar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              <Input
                defaultValue={it.title}
                onBlur={(e) => e.target.value !== it.title && update(it.id, { title: e.target.value })}
                className="border-0 px-0 h-auto py-0 text-lg font-semibold shadow-none focus-visible:ring-0"
              />
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-xl overflow-hidden bg-muted flex items-center justify-center max-h-[70vh]">
            {isImage && it.file_url && (
              <img
                src={it.file_url}
                alt={it.title}
                className="max-h-[70vh] w-auto object-contain"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setDims({ w: img.naturalWidth, h: img.naturalHeight });
                }}
              />
            )}
            {isVideo && it.file_url && (
              <video src={it.file_url} controls className="max-h-[70vh] w-auto" />
            )}
            {isPdf && it.file_url && (
              <object data={it.file_url} type="application/pdf" className="w-full h-[70vh]">
                <a href={it.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline p-3 block">Abrir PDF</a>
              </object>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Archivo</div>
              <div className="truncate" title={it.file_name ?? ""}>{it.file_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Fecha</div>
              <div>{dateLabel ?? "—"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Peso</div>
              <div>{sizeLabel ?? "—"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Medidas</div>
              <div>{dims ? `${dims.w} × ${dims.h}px` : isImage ? "Cargando…" : "—"}</div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            {it.file_url && (
              <a
                href={it.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download={it.file_name ?? undefined}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <Download className="w-4 h-4" /> Descargar
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SortableItemsList({ items, folders, update, remove, sensors, onReorder }: {
  items: Row[];
  folders: FolderRow[];
  update: (id: string, patch: any) => Promise<boolean>;
  remove: (id: string) => void;
  sensors: ReturnType<typeof useSensors>;
  onReorder: (activeId: string, overId: string) => void;
}) {
  const ids = items.map((it) => it.id);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(e) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        onReorder(String(active.id), String(over.id));
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {items.map((it) => (
            <SortableDeliverable key={it.id} it={it} folders={folders} update={update} remove={remove} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableDeliverable({ it, folders, update, remove }: { it: Row; folders: FolderRow[]; update: (id: string, patch: any) => Promise<boolean>; remove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: it.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {it.file_url
        ? <MediaTile it={it} update={update} remove={remove} dragHandle={{ attributes, listeners }} />
        : <DeliverableCard it={it} folders={folders} update={update} remove={remove} dragHandle={{ attributes, listeners }} />}
    </div>
  );
}

// ───────────────────────── Review thread ─────────────────────────

function ReviewPanel({ it, update }: { it: Row; update: (id: string, patch: any) => Promise<boolean> }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [sharing, setSharing] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("deliverable_comments")
      .select("*")
      .eq("deliverable_id", it.id)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as CommentRow[];
    setComments(rows);
    setLoaded(true);
    const unread = rows.filter((c) => c.author_role !== "agency" && !c.read_by_agency).map((c) => c.id);
    if (unread.length) {
      await supabase.from("deliverable_comments").update({ read_by_agency: true }).in("id", unread);
    }
  };

  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded]);

  // Lightweight count fetch on mount so badge is accurate
  useEffect(() => {
    let alive = true;
    supabase
      .from("deliverable_comments")
      .select("id", { count: "exact", head: true })
      .eq("deliverable_id", it.id)
      .then(({ count }) => {
        if (alive && count != null && !loaded) {
          setComments(Array.from({ length: count }, (_, i) => ({
            id: `stub-${i}`, deliverable_id: it.id, author: "", author_role: "agency" as const,
            author_name: null, read_by_agency: true, kind: "comment" as const, body: "", created_at: "",
          })));
        }
      });
    return () => { alive = false; };
  }, [it.id]);

  const resolveClientId = async (): Promise<string> => {
    if (it.client_id) return it.client_id;
    const { data } = await supabase.from("deliverables").select("client_id").eq("id", it.id).single();
    if (!data?.client_id) throw new Error("No se pudo determinar el cliente");
    return data.client_id as string;
  };

  const addComment = async (kind: CommentRow["kind"], text: string): Promise<boolean> => {
    if (!text.trim()) return false;
    const clientId = await resolveClientId();
    const { error } = await supabase.from("deliverable_comments").insert({
      deliverable_id: it.id,
      client_id: clientId,
      author: "agency",
      author_role: "agency",
      author_user_id: user?.id ?? null,
      author_name: (user?.user_metadata?.full_name as string | undefined) || user?.email || "Agencia",
      read_by_agency: true,
      kind,
      body: text.trim(),
    });
    if (error) { toast.error(error.message); return false; }
    setBody("");
    load();
    return true;
  };

  const createShareLink = async () => {
    setSharing(true);
    try {
      const clientId = await resolveClientId();
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      const expires = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
      const { error } = await supabase.from("deliverable_review_links").insert({
        deliverable_id: it.id,
        client_id: clientId,
        token,
        expires_at: expires,
        created_by: user?.id ?? null,
      });
      if (error) {
        toast.error(`No se pudo crear el enlace: ${error.message}`);
        return;
      }
      const url = `${window.location.origin}/review/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace de revisión copiado (válido 14 días)");
      } catch {
        // Sin permiso de portapapeles: mostramos el enlace para copiarlo a mano.
        toast.info(`Enlace de revisión creado (válido 14 días): ${url}`, { duration: 15000 });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el enlace de revisión");
    } finally {
      setSharing(false);
    }
  };

  const sendToReview = async () => {
    if (await update(it.id, { status: "in_review" })) toast.success("Marcado como En revisión cliente");
  };

  const approve = async () => {
    if (!(await addComment("approval", "Aprobado ✓"))) return;
    if (await update(it.id, { status: "done" })) toast.success("Entregable aprobado");
  };

  const requestChanges = async () => {
    if (!body.trim()) {
      toast.error("Escribe qué hay que cambiar antes de enviar");
      return;
    }
    if (!(await addComment("change_request", body))) return;
    if (await update(it.id, { status: "in_progress" })) toast.success("Cambios solicitados");
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este comentario?")) return;
    const res = await supabase.from("deliverable_comments").delete().eq("id", id).select("id");
    if (writeFailed(res, "No se pudo eliminar el comentario")) return;
    load();
  };

  const count = comments.length;
  const unreadCount = comments.filter((c) => c.author_role !== "agency" && !c.read_by_agency).length;


  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {count > 0 ? `${count} comentario${count === 1 ? "" : "s"}` : "Comentarios"}
          {unreadCount > 0 && (
            <span className="ml-1 rounded-full bg-warning/20 text-warning px-1.5 text-[10px] font-semibold">{unreadCount} nuevo{unreadCount === 1 ? "" : "s"}</span>
          )}
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs" disabled={sharing} onClick={createShareLink}>
          <Link2 className="w-3 h-3 mr-1" /> Enlace de revisión
        </Button>
        {it.status !== "in_review" && it.status !== "done" && (
          <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={sendToReview}>
            <Send className="w-3 h-3 mr-1" /> Enviar a revisión
          </Button>
        )}
        {it.status === "in_review" && (
          <>
            <Button size="sm" className="h-7 rounded-full text-xs bg-success text-success-foreground hover:bg-success/90" onClick={approve}>
              <ThumbsUp className="w-3 h-3 mr-1" /> Aprobar
            </Button>
            <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => setOpen(true)}>
              <RotateCcw className="w-3 h-3 mr-1" /> Pedir cambios
            </Button>
          </>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          {loaded && comments.length === 0 && (
            <div className="text-xs text-muted-foreground italic">Sin comentarios todavía.</div>
          )}
          {loaded && comments.map((c) => {
            const tone =
              c.kind === "approval" ? "border-success/40 bg-success/5"
              : c.kind === "change_request" ? "border-warning/40 bg-warning/5"
              : "border-border bg-secondary/30";
            const label =
              c.kind === "approval" ? "Aprobación"
              : c.kind === "change_request" ? "Cambios solicitados"
              : "Comentario";
            return (
              <div key={c.id} className={`rounded-xl border ${tone} px-3 py-2 group/cm`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    {label} · {c.author_name || (c.author_role === "client" ? "Cliente" : c.author_role === "guest" ? "Invitado" : "Agencia")} · {new Date(c.created_at).toLocaleString("es-CL")}
                  </div>
                  <button onClick={() => remove(c.id)} className="opacity-0 group-hover/cm:opacity-100 text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-sm mt-1 whitespace-pre-wrap">{c.body}</div>
              </div>
            );
          })}
          <div className="flex items-start gap-2">
            <Textarea
              rows={2}
              placeholder={it.status === "in_review" ? "Describe los cambios solicitados…" : "Escribe un comentario…"}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="text-sm"
            />
            <div className="flex flex-col gap-1">
              {it.status === "in_review" ? (
                <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={requestChanges}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Pedir cambios
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => addComment("comment", body)}>
                  <Send className="w-3 h-3 mr-1" /> Comentar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Timeline / Gantt ─────────────────────────

function TimelineView({ items, update }: { items: Row[]; update: (id: string, patch: any) => Promise<boolean> }) {
  const scheduled = items.filter((it) => it.due_date);
  const unscheduled = items.filter((it) => !it.due_date);

  if (scheduled.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aún no hay entregables con fecha. Asigna una fecha de entrega para verlos en la línea de tiempo.
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = scheduled.map((it) => new Date(it.due_date!));
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime()), today.getTime()));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime()), today.getTime()));
  // pad start to first day of month, end to last day of month
  const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  // build month columns
  const months: { label: string; days: number; offsetDays: number }[] = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const days = Math.round((monthEnd.getTime() - cursor.getTime()) / 86400000) + 1;
    const offsetDays = Math.round((cursor.getTime() - start.getTime()) / 86400000);
    months.push({
      label: cursor.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }),
      days,
      offsetDays,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const todayOffset = Math.round((today.getTime() - start.getTime()) / 86400000);
  const todayPct = (todayOffset / totalDays) * 100;

  // sort items by due date
  const sorted = [...scheduled].sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

  const statusBar: Record<Status, string> = {
    pending: "bg-muted-foreground/40",
    in_progress: "bg-warning",
    in_review: "bg-primary",
    done: "bg-success",
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-surface overflow-hidden">
        {/* Month header */}
        <div className="flex border-b bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          <div className="w-64 shrink-0 px-3 py-2 border-r font-medium">Entregable</div>
          <div className="flex-1 relative flex">
            {months.map((m, i) => (
              <div
                key={i}
                style={{ width: `${(m.days / totalDays) * 100}%` }}
                className="px-2 py-2 border-r last:border-r-0 truncate"
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="relative">
          {/* Today line */}
          {todayPct >= 0 && todayPct <= 100 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-primary/70 z-10 pointer-events-none"
              style={{ left: `calc(16rem + ${todayPct}% * (100% - 16rem) / 100)` }}
              title="Hoy"
            >
              <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-primary" />
            </div>
          )}

          {sorted.map((it) => {
            const d = new Date(it.due_date!);
            const offset = Math.round((d.getTime() - start.getTime()) / 86400000);
            const leftPct = (offset / totalDays) * 100;
            const M = statusMeta[it.status];
            const overdue = it.due_date! < chileToday() && it.status !== "done";
            return (
              <div key={it.id} className="flex items-center border-b last:border-b-0 hover:bg-secondary/20 transition-colors">
                <div className="w-64 shrink-0 px-3 py-2 border-r flex items-center gap-2 min-w-0">
                  <M.icon className={`w-4 h-4 shrink-0 ${M.cls}`} />
                  <div className="min-w-0">
                    <div className="text-sm truncate font-medium">{it.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {typeMeta[it.type].label} · {M.label}
                    </div>
                  </div>
                </div>
                <div className="flex-1 relative h-10">
                  <div className="absolute inset-y-0 left-0 right-0 flex pointer-events-none">
                    {months.map((m, i) => (
                      <div key={i} style={{ width: `${(m.days / totalDays) * 100}%` }} className="border-r border-border/40 last:border-r-0" />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => update(it.id, { status: nextStatus[it.status] })}
                    className={`absolute top-1/2 -translate-y-1/2 h-5 min-w-[1.25rem] rounded-md ${statusBar[it.status]} ${overdue ? "ring-2 ring-destructive" : ""} hover:scale-y-110 transition-transform shadow-sm`}
                    style={{
                      left: `${Math.max(0, leftPct - 1)}%`,
                      width: `${Math.min(6, Math.max(2, 100 / totalDays * 3))}%`,
                    }}
                    title={`${it.title} — ${d.toLocaleDateString("es-CL")}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {(["pending", "in_progress", "in_review", "done"] as Status[]).map((s) => (
          <div key={s} className="inline-flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${statusBar[s]}`} />
            {statusMeta[s].label}
          </div>
        ))}
        <div className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm ring-2 ring-destructive bg-transparent" />
          Vencido
        </div>
        <div className="inline-flex items-center gap-1.5">
          <span className="w-px h-3 bg-primary" />
          Hoy
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="rounded-2xl border border-dashed p-4 text-xs text-muted-foreground">
          <strong className="text-foreground font-medium">{unscheduled.length}</strong> entregable{unscheduled.length === 1 ? "" : "s"} sin fecha de entrega — no aparece{unscheduled.length === 1 ? "" : "n"} en la línea de tiempo.
        </div>
      )}
    </div>
  );
}
