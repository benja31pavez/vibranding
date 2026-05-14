import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Calendar, CheckCircle2, Circle, Clock, Image as ImageIcon, Film, Camera, Palette, Users, FileText, Package, Check, X, AlertCircle, Folder, FolderPlus, ChevronDown, ChevronRight, Pencil, Minus, GripVertical, Upload, Paperclip, Download, Loader2 } from "lucide-react";
import { uploadClientMedia } from "@/lib/uploadMedia";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  folder_id: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
};

type FolderRow = { id: string; name: string; sort_order: number };
type DividerRow = { id: string; label: string; sort_order: number };

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
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [dividers, setDividers] = useState<DividerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  const [view, setView] = useState<"list" | "kanban">("list");
  const [filterType, setFilterType] = useState<"all" | DType>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState({ title: "", description: "", due_date: "", type: "post" as DType, folder_id: "" as string });

  const load = async () => {
    setLoading(true);
    const [{ data: dItems, error }, { data: dFolders }, { data: dDividers }] = await Promise.all([
      supabase.from("deliverables").select("*").eq("client_id", clientId).order("sort_order").order("created_at"),
      supabase.from("deliverable_folders").select("*").eq("client_id", clientId).order("sort_order").order("created_at"),
      supabase.from("deliverable_dividers").select("*").eq("client_id", clientId).order("sort_order").order("created_at"),
    ]);
    if (error) toast.error(error.message);
    setItems((dItems ?? []).map((r: any) => ({ ...r, checklist: r.checklist ?? [] })) as Row[]);
    setFolders((dFolders ?? []) as FolderRow[]);
    setDividers((dDividers ?? []) as DividerRow[]);
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

  const createDivider = async () => {
    const maxOrder = Math.max(0, ...folders.map((f) => f.sort_order), ...dividers.map((d) => d.sort_order));
    const { error } = await supabase.from("deliverable_dividers").insert({
      client_id: clientId,
      label: "Nueva fase",
      sort_order: maxOrder + 1,
    });
    if (error) return toast.error(error.message);
    load();
  };

  const renameDivider = async (id: string, label: string) => {
    const { error } = await supabase.from("deliverable_dividers").update({ label }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const removeDivider = async (id: string) => {
    const { error } = await supabase.from("deliverable_dividers").delete().eq("id", id);
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
    const entries = [
      ...folders.map((f) => ({ kind: "folder" as const, id: `f-${f.id}`, raw: f })),
      ...dividers.map((d) => ({ kind: "divider" as const, id: `d-${d.id}`, raw: d })),
    ].sort((a, b) => a.raw.sort_order - b.raw.sort_order);
    const oldIdx = entries.findIndex((x) => x.id === active.id);
    const newIdx = entries.findIndex((x) => x.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(entries, oldIdx, newIdx);

    // Optimistic update
    const newFolders = folders.map((f) => ({ ...f, sort_order: reordered.findIndex((x) => x.kind === "folder" && x.raw.id === f.id) }));
    const newDividers = dividers.map((d) => ({ ...d, sort_order: reordered.findIndex((x) => x.kind === "divider" && x.raw.id === d.id) }));
    setFolders(newFolders.sort((a, b) => a.sort_order - b.sort_order));
    setDividers(newDividers.sort((a, b) => a.sort_order - b.sort_order));

    // Persist
    const updates = reordered.map((entry, idx) => {
      const table = entry.kind === "folder" ? "deliverable_folders" : "deliverable_dividers";
      return supabase.from(table).update({ sort_order: idx }).eq("id", entry.raw.id);
    });
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
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAddingFolder(true)}>
            <FolderPlus className="w-4 h-4 mr-1" /> Carpeta
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={createDivider}>
            <Minus className="w-4 h-4 mr-1" /> Divisor
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
      </div>

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

      {loading ? <div className="text-sm text-muted-foreground">Cargando…</div>
        : filtered.length === 0 && folders.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aún no hay entregables.
          </div>
        ) : view === "kanban" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["pending", "in_progress", "done"] as Status[]).map((col) => (
              <div key={col} className="rounded-2xl bg-secondary/40 p-3 space-y-2 min-h-[200px]">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground px-1">
                  <span>{statusMeta[col].label}</span>
                  <span>{filtered.filter((x) => x.status === col).length}</span>
                </div>
                {filtered.filter((x) => x.status === col).map((it) => (
                  <DeliverableCard key={it.id} it={it} folders={folders} update={update} remove={remove} compact />
                ))}
              </div>
            ))}
          </div>
        ) : (() => {
          const sortedEntries = [
            ...folders.map((f) => ({ kind: "folder" as const, sort_order: f.sort_order, data: f, sortId: `f-${f.id}` })),
            ...dividers.map((d) => ({ kind: "divider" as const, sort_order: d.sort_order, data: d, sortId: `d-${d.id}` })),
          ].sort((a, b) => a.sort_order - b.sort_order);
          return (
          <div className="space-y-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedEntries.map((e) => e.sortId)} strategy={verticalListSortingStrategy}>
                {sortedEntries.map((entry) => {
                  if (entry.kind === "divider") {
                    const d = entry.data;
                    return (
                      <SortableWrapper key={entry.sortId} id={entry.sortId}>
                        {(handle) => <DividerLine divider={d} onRename={(label) => renameDivider(d.id, label)} onDelete={() => removeDivider(d.id)} dragHandle={handle} />}
                      </SortableWrapper>
                    );
                  }
                  const f = entry.data;
                  const list = grouped.get(f.id) ?? [];
                  const isCollapsed = collapsed[f.id];
                  return (
                    <SortableWrapper key={entry.sortId} id={entry.sortId}>
                      {(handle) => (
                        <FolderSection
                          folder={f}
                          count={list.length}
                          collapsed={!!isCollapsed}
                          onToggle={() => setCollapsed((s) => ({ ...s, [f.id]: !s[f.id] }))}
                          onRename={(name) => renameFolder(f.id, name)}
                          onDelete={() => removeFolder(f.id)}
                          onDropFiles={(files) => uploadFiles(files, f.id)}
                          isDragOver={dragOver === f.id}
                          onDragOver={() => setDragOver(f.id)}
                          onDragLeave={() => setDragOver((d) => (d === f.id ? null : d))}
                          dragHandle={handle}
                        >
                          {list.length === 0 ? (
                            <div className="text-xs text-muted-foreground px-1 py-2">Vacía — arrastra archivos aquí</div>
                          ) : (
                            <SortableItemsList
                              items={list}
                              folders={folders}
                              update={update}
                              remove={remove}
                              sensors={sensors}
                              onReorder={(a, o) => reorderItems(f.id, a, o)}
                            />
                          )}
                        </FolderSection>
                      )}
                    </SortableWrapper>
                  );
                })}
              </SortableContext>
            </DndContext>
            {(grouped.get(null) ?? []).length > 0 && (
              <div className="space-y-2">
                {folders.length > 0 && (
                  <div className="text-xs uppercase tracking-wider text-muted-foreground px-1">Sin carpeta</div>
                )}
                <SortableItemsList
                  items={grouped.get(null) ?? []}
                  folders={folders}
                  update={update}
                  remove={remove}
                  sensors={sensors}
                  onReorder={(a, o) => reorderItems(null, a, o)}
                />
              </div>
            )}
          </div>
          );
        })()}
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

function DeliverableCard({ it, folders, update, remove, compact, dragHandle }: { it: Row; folders: FolderRow[]; update: (id: string, patch: any) => void; remove: (id: string) => void; compact?: boolean; dragHandle?: DragHandle }) {
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
            <Select value={it.folder_id ?? "none"} onValueChange={(v) => update(it.id, { folder_id: v === "none" ? null : v })}>
              <SelectTrigger className="h-7 text-xs w-auto gap-1 rounded-full border-0 bg-secondary px-2.5">
                <Folder className="w-3 h-3" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin carpeta</SelectItem>
                {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
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

function DividerLine({ divider, onRename, onDelete, dragHandle }: { divider: DividerRow; onRename: (label: string) => void; onDelete: () => void; dragHandle?: DragHandle }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(divider.label);
  return (
    <div className="flex items-center gap-2 group py-1">
      {dragHandle && (
        <button {...dragHandle.attributes} {...dragHandle.listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none opacity-0 group-hover:opacity-100" aria-label="Reordenar">
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-border" />
      {editing ? (
        <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)}
          onBlur={() => { setEditing(false); if (label.trim() && label !== divider.label) onRename(label.trim()); else setLabel(divider.label); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setLabel(divider.label); setEditing(false); } }}
          className="h-7 text-xs uppercase tracking-wider font-semibold max-w-[260px] text-center" />
      ) : (
        <button onClick={() => setEditing(true)} className="text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground px-2">
          {divider.label || "Sin título"}
        </button>
      )}
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-border" />
    </div>
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

function SortableItemsList({ items, folders, update, remove, sensors, onReorder }: {
  items: Row[];
  folders: FolderRow[];
  update: (id: string, patch: any) => void;
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

function SortableDeliverable({ it, folders, update, remove }: { it: Row; folders: FolderRow[]; update: (id: string, patch: any) => void; remove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: it.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <DeliverableCard it={it} folders={folders} update={update} remove={remove} dragHandle={{ attributes, listeners }} />
    </div>
  );
}
