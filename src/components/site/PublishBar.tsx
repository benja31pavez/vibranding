import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/app";
import { displayUrl } from "@/lib/site/siteStatus";

/**
 * Cabecera compacta de los editores de sitio (una fila en escritorio):
 * navegación a la izquierda; estado, interruptor Publicar, link público
 * (clic = copiar) y "Ver publicado" (ícono con tooltip) a la derecha. `publicUrl` debe ser la URL
 * de producción (ver `landingPublicUrl` / `multilinkPublicUrlFor`).
 */
export function PublishBar({
  nav,
  published,
  publicUrl,
  onTogglePublished,
  toggling,
  readOnly,
}: {
  /** Barra de pestañas (página + vista). */
  nav: React.ReactNode;
  published: boolean;
  publicUrl: string;
  onTogglePublished?: () => void;
  toggling?: boolean;
  /** Solo lectura: sin interruptor Publicar. */
  readOnly?: boolean;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success(
        published ? "Link copiado" : "Link copiado (aún es borrador: publícalo para que funcione)",
      );
    } catch {
      toast.error("No se pudo copiar. Selecciona el link y cópialo a mano.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-0 max-w-full">{nav}</div>
      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
        <StatusBadge
          status={published ? "published" : "draft"}
          label={published ? "Publicado" : "Borrador"}
          tone={published ? "success" : "warning"}
        />
        {!readOnly && onTogglePublished && (
          <label className="mr-1 flex items-center gap-2 text-sm">
            <Switch
              checked={published}
              onCheckedChange={onTogglePublished}
              disabled={toggling}
              aria-label={published ? "Pasar a borrador" : "Publicar"}
            />
            Publicar
          </label>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copy()}
          title={`Copiar link: ${publicUrl}`}
          className="h-8 max-w-[16rem] gap-1.5 px-2 font-normal min-[1400px]:px-3"
        >
          <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Copiar link: </span>
          {/* Con poco ancho queda solo el ícono (el link va en el title) para no partir la fila. */}
          <span className="hidden truncate min-[1400px]:inline">{displayUrl(publicUrl)}</span>
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {published ? (
                <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer" aria-label="Ver publicado">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
              ) : (
                // span: un botón deshabilitado no recibe foco ni hover para el tooltip
                <span tabIndex={0} aria-label="Ver publicado (no disponible: es borrador)">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent>
              {published ? "Ver publicado" : "Publica la página para verla en su URL pública"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
