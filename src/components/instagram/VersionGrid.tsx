import { Film, Layers, Image as ImageIcon, Lock, Heart } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { IGPost } from "@/components/InstagramEditor";
import { usePostInsights } from "@/hooks/use-post-insights";

const FORMAT_ICON = { photo: ImageIcon, carousel: Layers, reel: Film } as const;

/** Read-only rendering of a locked historical grid version. */
export function VersionGrid({ clientId, posts }: { clientId: string; posts: IGPost[] }) {
  const { metrics } = usePostInsights(clientId);
  const sorted = [...posts].sort((a, b) => a.position - b.position);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-xl border bg-surface px-4 py-6 text-center">
        Esta versión no tiene publicaciones registradas.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Solo lectura
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Es un registro histórico de cómo estaba la cuenta en esa fecha: no se puede editar,
              reordenar ni eliminar. Trabaja sobre la vista "Propuesta".
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span>· {sorted.length} publicaciones</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {sorted.map((p) => {
          const Icon = FORMAT_ICON[p.format] ?? ImageIcon;
          const m = p.ig_media_id ? metrics[p.ig_media_id] : undefined;
          const img = p.cover_url || p.image_url;
          return (
            <div
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-md bg-muted"
            >
              {img ? (
                <img
                  src={img}
                  alt={p.caption?.slice(0, 60) ?? "Publicación"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-muted-foreground">
                  <Icon className="w-5 h-5" />
                </div>
              )}
              <Icon className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-white drop-shadow" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white line-clamp-3 whitespace-pre-wrap">
                  {p.caption?.trim() || "Sin caption"}
                </p>
              </div>
              {(m || p.likes_count > 0) && (
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                  <Heart className="w-2.5 h-2.5" />
                  {m ? m.engagement.toLocaleString("es-CL") : p.likes_count.toLocaleString("es-CL")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
