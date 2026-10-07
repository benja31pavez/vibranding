/**
 * Visor de archivos ("lightbox") compartido por la agencia y el panel del
 * cliente: la pieza en grande sobre fondo oscuro, láminas del carrusel con
 * miniaturas, flechas (y ← →) para pasar entre archivos, abrir y descargar.
 * Solo presentación: recibe la lista y el índice por props.
 */
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FileTypeTile, type FileVisualMedia } from "./fileVisuals";

export interface LightboxItem {
  id: string;
  name: string;
  media: FileVisualMedia;
  thumbUrl: string | null;
  /** Lo que se ve en grande (varias láminas en un carrusel). */
  urls: string[];
}

export interface FileLightboxProps<T extends LightboxItem> {
  items: readonly T[];
  /** Archivo abierto (índice en `items`) o null si el visor está cerrado. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Línea bajo el título: tipo, fecha, estado… */
  renderMeta?: (item: T) => ReactNode;
  downloadHref: (url: string, name: string) => string;
  /** ¿Se puede incrustar este PDF? (el panel del cliente solo incrusta URLs firmadas). */
  canEmbedPdf?: (url: string) => boolean;
}

const STAGE_HEIGHT = "h-[min(64vh,620px)]";
const NAV_BUTTON =
  "absolute top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/45 text-white backdrop-blur hover:bg-black/65 hover:text-white focus-visible:ring-2 focus-visible:ring-white";

function Stage({
  item,
  url,
  canEmbedPdf,
}: {
  item: LightboxItem;
  url: string;
  canEmbedPdf: (url: string) => boolean;
}) {
  const media = "max-h-full max-w-full object-contain motion-safe:animate-in motion-safe:fade-in-0";
  if (item.media === "video") {
    return (
      <video
        key={url}
        src={url}
        controls
        playsInline
        poster={item.thumbUrl ?? undefined}
        className={media}
      />
    );
  }
  if (item.media === "image") {
    return <img key={url} src={url} alt={item.name} className={cn(media, "drop-shadow-2xl")} />;
  }
  if (item.media === "pdf" && canEmbedPdf(url)) {
    return (
      <iframe
        key={url}
        src={`${url}#toolbar=0&navpanes=0`}
        title={item.name}
        className="h-full w-full rounded-app-md bg-white"
      />
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 text-center text-white">
      <FileTypeTile media={item.media} name={item.name} url={url} size="lg" />
      <p className="max-w-xs text-sm text-white/80">
        Este archivo no tiene vista previa. Ábrelo o descárgalo para verlo.
      </p>
    </div>
  );
}

function SlideStrip({
  urls,
  index,
  onSelect,
}: {
  urls: readonly string[];
  index: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div role="group" aria-label="Láminas" className="flex min-w-0 gap-1.5 overflow-x-auto py-0.5">
      {urls.map((u, i) => (
        <button
          key={`${i}-${u.slice(-24)}`}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Lámina ${i + 1}`}
          aria-current={i === index}
          className={cn(
            "h-11 w-9 shrink-0 overflow-hidden rounded-app-sm border-2 bg-surface-2",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            i === index ? "border-brand-1" : "border-transparent opacity-70 hover:opacity-100",
          )}
        >
          <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

/** Visor de archivos con navegación entre piezas y láminas. */
export function FileLightbox<T extends LightboxItem>({
  items,
  index,
  onIndexChange,
  onClose,
  renderMeta,
  downloadHref,
  canEmbedPdf = () => true,
}: FileLightboxProps<T>) {
  const [slide, setSlide] = useState(0);
  const item = index !== null ? items[index] : undefined;
  const slides = item?.urls.length ?? 0;
  const current = item ? (item.urls[slide] ?? item.urls[0] ?? "") : "";
  const total = items.length;

  const goFile = (delta: number, toLastSlide = false) => {
    if (index === null || total < 2) return;
    const next = (index + delta + total) % total;
    const nextSlides = items[next]?.urls.length ?? 1;
    setSlide(toLastSlide ? Math.max(0, nextSlides - 1) : 0);
    onIndexChange(next);
  };
  /** ← →: primero recorre las láminas del carrusel; al final pasa al archivo vecino. */
  const step = (delta: number) => {
    const target = slide + delta;
    if (target >= 0 && target < slides) setSlide(target);
    else goFile(delta, delta < 0);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
  };

  const fileName = item && slides > 1 ? `${item.name} (${slide + 1})` : (item?.name ?? "");
  const canDownload = item && item.media !== "page" && current;

  return (
    <Dialog
      open={item !== undefined}
      onOpenChange={(open) => {
        if (open) return;
        setSlide(0);
        onClose();
      }}
    >
      <DialogContent
        onKeyDown={onKeyDown}
        className="flex max-h-[calc(100dvh-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0"
      >
        {item && (
          <>
            <DialogHeader className="space-y-1 border-b border-border-subtle px-5 py-3.5 pr-12 text-left">
              <DialogTitle className="truncate text-base">{item.name}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  {renderMeta?.(item)}
                  {total > 1 && (
                    <span className="tabular-nums text-muted-foreground">
                      · {(index ?? 0) + 1} de {total}
                    </span>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>

            <div
              className={cn(
                "relative flex items-center justify-center bg-[oklch(0.17_0.01_270)] p-4 sm:px-16",
                STAGE_HEIGHT,
              )}
            >
              {current && <Stage item={item} url={current} canEmbedPdf={canEmbedPdf} />}
              {(total > 1 || slides > 1) && (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn(NAV_BUTTON, "left-3")}
                    onClick={() => step(-1)}
                    aria-label={slide > 0 ? "Lámina anterior" : "Archivo anterior"}
                  >
                    <ChevronLeft aria-hidden className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn(NAV_BUTTON, "right-3")}
                    onClick={() => step(1)}
                    aria-label={slide < slides - 1 ? "Lámina siguiente" : "Archivo siguiente"}
                  >
                    <ChevronRight aria-hidden className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>

            <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {slides > 1 && <SlideStrip urls={item.urls} index={slide} onSelect={setSlide} />}
                <p
                  className="shrink-0 text-xs tabular-nums text-muted-foreground"
                  aria-live="polite"
                >
                  {slides > 1 ? `Lámina ${slide + 1} de ${slides}` : ""}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {current && (
                  <Button asChild size="sm" variant="outline">
                    <a href={current} target="_blank" rel="noopener noreferrer">
                      <ExternalLink aria-hidden className="mr-1.5 h-4 w-4" /> Abrir
                      <span className="sr-only"> (se abre en otra pestaña)</span>
                    </a>
                  </Button>
                )}
                {canDownload && (
                  <Button asChild size="sm">
                    <a
                      href={downloadHref(current, fileName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      <Download aria-hidden className="mr-1.5 h-4 w-4" /> Descargar
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
