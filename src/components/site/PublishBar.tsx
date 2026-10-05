import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Cabecera común de los editores de sitio: estado publicado/borrador,
 * "Ver publicado" y "Copiar link".
 */
export function PublishBar({
  title,
  subtitle,
  published,
  publicUrl,
  onTogglePublished,
  toggling,
}: {
  title: string;
  subtitle: string;
  published: boolean;
  publicUrl: string;
  onTogglePublished: () => void;
  toggling?: boolean;
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
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              published
                ? "border-emerald-600/40 text-emerald-700 bg-emerald-500/10 dark:text-emerald-400"
                : "border-amber-600/40 text-amber-800 bg-amber-500/10 dark:text-amber-300"
            }`}
          >
            {published ? "Publicado" : "Borrador"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        <p className="mt-1 text-xs text-muted-foreground break-all">{publicUrl}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm mr-1">
          <Switch
            checked={published}
            onCheckedChange={onTogglePublished}
            disabled={toggling}
            aria-label={published ? "Pasar a borrador" : "Publicar"}
          />
          {published ? "Visible al público" : "Publicar"}
        </label>
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy className="w-4 h-4 mr-1" aria-hidden="true" /> Copiar link
        </Button>
        {published ? (
          <Button variant="outline" size="sm" asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" aria-hidden="true" /> Ver publicado
            </a>
          </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* span: un botón deshabilitado no recibe foco ni hover para el tooltip */}
                <span tabIndex={0}>
                  <Button variant="outline" size="sm" disabled>
                    <ExternalLink className="w-4 h-4 mr-1" aria-hidden="true" /> Ver publicado
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Publica la página para verla en su URL pública</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
