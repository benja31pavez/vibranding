import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Link2Off, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  listUnmatchedMedia,
  matchPostToMedia,
  type UnmatchedMedia,
} from "@/lib/meta/igSync.functions";

/** Links a planned (proposed) post to the real Instagram media it became. */
export function MediaMatchPopover({
  clientId,
  postId,
  igMediaId,
  onMatched,
}: {
  clientId: string;
  postId: string;
  igMediaId: string | null;
  onMatched: (igMediaId: string | null, publishedAt: string | null) => void;
}) {
  const listMedia = useServerFn(listUnmatchedMedia);
  const match = useServerFn(matchPostToMedia);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<UnmatchedMedia[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || igMediaId) return;
    setLoading(true);
    listMedia({ data: { clientId } })
      .then((rows) => setMedia(rows))
      .catch((e: any) => toast.error(e?.message ?? "No se pudo leer Instagram"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId, igMediaId]);

  const apply = async (mediaId: string | null) => {
    setSaving(true);
    try {
      const res = await match({ data: { clientId, postId, igMediaId: mediaId } });
      onMatched(mediaId, res.publishedAt ?? null);
      setOpen(false);
      toast.success(mediaId ? "Post vinculado a la publicación real" : "Vínculo eliminado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo vincular");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={igMediaId ? "Vinculado a Instagram" : "Vincular con publicación real"}
        >
          {igMediaId ? (
            <Link2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Link2Off className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        {igMediaId ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Vinculado a la publicación <span className="font-mono">{igMediaId}</span>
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs"
              disabled={saving}
              onClick={() => apply(null)}
            >
              Quitar vínculo
            </Button>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando publicaciones…
          </div>
        ) : media.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">
            No hay publicaciones recientes sin vincular. Sincroniza Instagram primero.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1">
            {media.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={saving}
                onClick={() => apply(m.id)}
                className="w-full flex items-center gap-2 rounded-md p-1.5 text-left hover:bg-muted disabled:opacity-50"
              >
                <span className="w-9 h-9 shrink-0 rounded overflow-hidden bg-muted">
                  {m.thumbnail && (
                    <img src={m.thumbnail} alt="" className="w-full h-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] truncate">
                    {m.caption?.trim() || "Sin caption"}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {m.mediaType ?? "—"} ·{" "}
                    {m.timestamp
                      ? new Date(m.timestamp).toLocaleDateString("es-CL", {
                          day: "2-digit",
                          month: "short",
                        })
                      : "sin fecha"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
