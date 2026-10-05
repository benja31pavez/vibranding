import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Heart,
  Images,
  Film,
  Image as ImageIcon,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { writeFailed } from "@/lib/writeCheck";
import { useOptionalActiveClient } from "@/contexts/ActiveClientContext";
import { ErrorState } from "@/components/app";
import { usePostInsights } from "@/hooks/use-post-insights";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Post = {
  id: string;
  client_id: string;
  type: "current" | "proposed";
  format: "photo" | "carousel" | "reel";
  image_url: string | null;
  cover_url: string | null;
  carousel_urls: string[];
  caption: string | null;
  music: string | null;
  location: string | null;
  objective: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  ig_media_id: string | null;
};

const FORMAT_ICON = { photo: ImageIcon, carousel: Images, reel: Film } as const;

function thumb(p: Post) {
  return p.cover_url || p.image_url || p.carousel_urls?.[0] || null;
}

function tileDate(p: Post): Date | null {
  const raw = p.scheduled_at ?? p.published_at;
  return raw ? new Date(raw) : null;
}

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

/* ---------------------------------- tiles --------------------------------- */

function PostTile({
  post,
  engagement,
  onClick,
  compact,
}: {
  post: Post;
  engagement?: number;
  onClick: () => void;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id });
  const Icon = FORMAT_ICON[post.format] ?? ImageIcon;
  const src = thumb(post);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`group cursor-grab active:cursor-grabbing rounded-lg border bg-background overflow-hidden ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 p-1">
        <div className="w-7 h-7 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center">
          {src ? (
            <img
              src={src}
              alt={post.caption ?? "Publicación"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] leading-tight truncate">
            {post.caption?.trim() ? (
              post.caption
            ) : (
              <span className="text-muted-foreground italic">Sin caption</span>
            )}
          </p>
          {!compact && (
            <p className="text-[9px] text-muted-foreground truncate">
              {post.format}
              {post.objective ? ` · ${post.objective}` : ""}
            </p>
          )}
        </div>
        {post.ig_media_id && typeof engagement === "number" && (
          <span className="flex items-center gap-0.5 text-[9px] font-semibold text-accent shrink-0 pr-0.5">
            <Heart className="w-2.5 h-2.5" />
            {engagement}
          </span>
        )}
      </div>
    </div>
  );
}

function DayCell({
  date,
  posts,
  metricsByMedia,
  dim,
  onOpen,
  minHeight,
}: {
  date: Date;
  posts: Post[];
  metricsByMedia: Record<string, { engagement: number }>;
  dim?: boolean;
  onOpen: (p: Post) => void;
  minHeight: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dayKey(date)}` });
  const today = isSameDay(date, new Date());
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-1.5 space-y-1 transition-colors ${minHeight} ${
        isOver ? "border-accent bg-accent/10" : "bg-surface"
      } ${dim ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[11px] font-semibold ${
            today
              ? "bg-accent text-accent-foreground rounded-full w-5 h-5 grid place-items-center"
              : ""
          }`}
        >
          {format(date, "d")}
        </span>
        {posts.length > 0 && (
          <span className="text-[9px] text-muted-foreground">{posts.length}</span>
        )}
      </div>
      {posts.map((p) => (
        <PostTile
          key={p.id}
          post={p}
          engagement={p.ig_media_id ? metricsByMedia[p.ig_media_id]?.engagement : undefined}
          onClick={() => onOpen(p)}
          compact
        />
      ))}
    </div>
  );
}

/* --------------------------------- editor --------------------------------- */

function PostEditor({
  post,
  onClose,
  onSaved,
}: {
  post: Post;
  onClose: () => void;
  onSaved: (p: Post) => void;
}) {
  const [draft, setDraft] = useState(post);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await supabase
      .from("instagram_posts")
      .update({
        caption: draft.caption,
        music: draft.music,
        location: draft.location,
        objective: draft.objective,
        scheduled_at: draft.scheduled_at,
      })
      .eq("id", draft.id)
      .select("id");
    setSaving(false);
    if (writeFailed(res)) return;
    toast.success("Publicación actualizada");
    onSaved(draft);
    onClose();
  };

  const src = thumb(draft);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar publicación</DialogTitle>
          <DialogDescription>
            {draft.format} · {draft.type === "proposed" ? "Propuesta" : "Publicada"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden shrink-0">
              {src && <img src={src} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-sm font-semibold">Caption</Label>
              <Textarea
                autoFocus
                rows={5}
                placeholder="Escribe el caption de esta publicación…"
                value={draft.caption ?? ""}
                onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Música</Label>
              <Input
                value={draft.music ?? ""}
                onChange={(e) => setDraft({ ...draft, music: e.target.value })}
                placeholder="Artista — canción"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ubicación</Label>
              <Input
                value={draft.location ?? ""}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="Santiago, Chile"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Objetivo</Label>
              <Input
                value={draft.objective ?? ""}
                onChange={(e) => setDraft({ ...draft, objective: e.target.value })}
                placeholder="Alcance, comunidad, ventas…"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha programada</Label>
              <Input
                type="datetime-local"
                value={
                  draft.scheduled_at
                    ? format(new Date(draft.scheduled_at), "yyyy-MM-dd'T'HH:mm")
                    : ""
                }
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- main ---------------------------------- */

export function ContentCalendar({ clientId }: { clientId: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [editing, setEditing] = useState<Post | null>(null);
  const [dragging, setDragging] = useState<Post | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const activeClient = useOptionalActiveClient();
  const { metrics } = usePostInsights(clientId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("instagram_posts")
        .select(
          "id,client_id,type,format,image_url,cover_url,carousel_urls,caption,music,location,objective,scheduled_at,published_at,ig_media_id",
        )
        .eq("client_id", clientId)
        .is("archived_at", null)
        .order("position", { ascending: true });
      if (cancelled) return;
      if (error) setLoadError(error.message);
      else setPosts((data ?? []) as unknown as Post[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadTick]);

  /** Refleja el cambio en el contexto del cliente para que Ficha y Grid vean la fecha nueva. */
  const syncContext = (id: string, patch: Partial<Post>) => {
    activeClient?.setPosts((cur) =>
      cur.map((p) => (p.id === id ? ({ ...p, ...patch } as typeof p) : p)),
    );
  };

  const days = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfMonth(cursor);
    const total = Math.ceil((+end - +start) / 86400000 / 7) * 7 + 7;
    return Array.from({ length: total }, (_, i) => addDays(start, i)).slice(0, 42);
  }, [cursor, view]);

  const byDay = useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const p of posts) {
      const d = tileDate(p);
      if (!d) continue;
      const k = dayKey(d);
      (map[k] ??= []).push(p);
    }
    return map;
  }, [posts]);

  const unscheduled = useMemo(
    () => posts.filter((p) => !p.scheduled_at && !p.published_at),
    [posts],
  );

  const onDragEnd = async (e: DragEndEvent) => {
    setDragging(null);
    const overId = String(e.over?.id ?? "");
    if (!overId.startsWith("day:")) return;
    const post = posts.find((p) => p.id === String(e.active.id));
    if (!post) return;
    const target = overId.slice(4);
    const prev = post.scheduled_at ? new Date(post.scheduled_at) : null;
    const next = new Date(`${target}T${prev ? format(prev, "HH:mm") : "12:00"}:00`);
    const iso = next.toISOString();
    setPosts((cur) => cur.map((p) => (p.id === post.id ? { ...p, scheduled_at: iso } : p)));
    const res = await supabase
      .from("instagram_posts")
      .update({ scheduled_at: iso })
      .eq("id", post.id)
      .select("id");
    if (writeFailed(res, "No se pudo reprogramar")) {
      setPosts((cur) =>
        cur.map((p) => (p.id === post.id ? { ...p, scheduled_at: post.scheduled_at } : p)),
      );
      return;
    }
    syncContext(post.id, { scheduled_at: iso });
    toast.success(`Programada para ${format(next, "d 'de' MMMM, HH:mm", { locale: es })}`);
  };

  const step = (dir: number) =>
    setCursor((c) => (view === "week" ? addWeeks(c, dir) : addMonths(c, dir)));

  if (loadError) {
    return (
      <ErrorState
        title="No pudimos cargar el calendario"
        message={loadError}
        onRetry={() => setReloadTick((t) => t + 1)}
        retrying={loading}
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) =>
        setDragging(posts.find((p) => p.id === String(e.active.id)) ?? null)
      }
      onDragEnd={onDragEnd}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays aria-hidden className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold capitalize">
              {view === "week"
                ? `Semana del ${format(days[0]!, "d 'de' MMMM yyyy", { locale: es })}`
                : format(cursor, "MMMM yyyy", { locale: es })}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setView("month")}
                className={`px-3 py-1.5 text-xs ${view === "month" ? "bg-accent text-accent-foreground" : ""}`}
              >
                Mes
              </button>
              <button
                onClick={() => setView("week")}
                className={`px-3 py-1.5 text-xs ${view === "week" ? "bg-accent text-accent-foreground" : ""}`}
              >
                Semana
              </button>
            </div>
            <Button variant="outline" size="icon" onClick={() => step(-1)} aria-label="Anterior">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
              Hoy
            </Button>
            <Button variant="outline" size="icon" onClick={() => step(1)} aria-label="Siguiente">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-4 items-start">
          <div>
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <div key={d} className="text-[11px] font-medium text-muted-foreground text-center">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((d) => (
                <DayCell
                  key={dayKey(d)}
                  date={d}
                  posts={byDay[dayKey(d)] ?? []}
                  metricsByMedia={metrics}
                  dim={view === "month" && !isSameMonth(d, cursor)}
                  onOpen={setEditing}
                  minHeight={view === "week" ? "min-h-[380px]" : "min-h-[110px]"}
                />
              ))}
            </div>
          </div>

          <aside className="rounded-xl border bg-surface p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Sin programar</h2>
              <Badge variant="secondary">{unscheduled.length}</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Arrastra una publicación al calendario para programarla.
            </p>
            <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
              {loading && <p className="text-xs text-muted-foreground">Cargando…</p>}
              {!loading && unscheduled.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Todas las publicaciones tienen fecha.
                </p>
              )}
              {unscheduled.map((p) => (
                <PostTile key={p.id} post={p} onClick={() => setEditing(p)} />
              ))}
            </div>
            <div className="pt-2 border-t flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Target className="w-3 h-3" /> El número junto al corazón es la interacción real.
            </div>
          </aside>
        </div>
      </div>

      <DragOverlay>
        {dragging && (
          <div className="rounded-lg border bg-background px-2 py-1 text-[10px] shadow-lg">
            {dragging.caption?.trim() || `Publicación ${dragging.format}`}
          </div>
        )}
      </DragOverlay>

      {editing && (
        <PostEditor
          post={editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            setPosts((cur) => cur.map((x) => (x.id === p.id ? p : x)));
            syncContext(p.id, {
              caption: p.caption,
              music: p.music,
              location: p.location,
              objective: p.objective,
              scheduled_at: p.scheduled_at,
            });
          }}
        />
      )}
    </DndContext>
  );
}
