import { useCallback, useEffect, useId, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { withAlpha, type FaqItem, type GalleryItem, type LandingPalette } from "@/lib/landingTheme";

export const H2 =
  "text-[1.75rem] leading-tight sm:text-4xl md:text-[2.75rem] font-bold tracking-tight [text-wrap:balance]";

/** Encabezado de sección: antetítulo en color de marca, título y bajada opcional. */
export function SectionHeading({
  eyebrow,
  title,
  palette,
  lead,
  align = "center",
  tight,
}: {
  eyebrow: string;
  title: string;
  palette: LandingPalette;
  lead?: string;
  align?: "center" | "left";
  tight?: boolean;
}) {
  const center = align === "center";
  return (
    <div
      className={`${center ? "text-center mx-auto" : ""} max-w-2xl ${tight ? "mb-6" : "mb-10 md:mb-14"}`}
    >
      <div
        className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] ${center ? "justify-center" : ""}`}
        style={{ color: palette.brandText }}
      >
        <span
          className="h-px w-6 rounded-full"
          style={{ background: palette.brand }}
          aria-hidden="true"
        />
        {eyebrow}
      </div>
      <h2 className={`${H2} mt-3`}>{title}</h2>
      {lead && (
        <p
          className="mt-4 text-base md:text-lg [text-wrap:pretty]"
          style={{ color: palette.muted }}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

export function SocialLink({
  href,
  label,
  palette,
  children,
}: {
  href: string;
  label: string;
  palette: LandingPalette;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="grid place-items-center min-w-11 h-11 px-1 rounded-full border transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ borderColor: palette.border, outlineColor: palette.brand, color: palette.text }}
    >
      {children}
    </a>
  );
}

/** Imagen con fondo de marca mientras carga (o si falla), sin saltos de diseño. */
export function FramedImage({
  src,
  alt,
  width,
  height,
  palette,
  className = "",
  imgClassName = "",
  style,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  palette: LandingPalette;
  className?: string;
  imgClassName?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`overflow-hidden ${className}`} style={{ background: palette.tint, ...style }}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={`w-full h-full object-cover ${imgClassName}`}
      />
    </div>
  );
}

export function BeforeAfter({ item, palette: p }: { item: GalleryItem; palette: LandingPalette }) {
  const tag = (text: string) => (
    <span
      className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur"
      style={{ background: "rgba(0,0,0,0.72)", color: "#ffffff" }}
    >
      {text}
    </span>
  );
  const photo = (src: string, label: string) => (
    <div className="relative">
      <FramedImage
        src={src}
        alt={`${label}${item.caption ? `: ${item.caption}` : ""}`}
        width={800}
        height={600}
        palette={p}
        className="rounded-2xl aspect-[4/3]"
      />
      {tag(label)}
    </div>
  );
  return (
    <figure>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {photo(item.before_url ?? "", "Antes")}
        {photo(item.url, "Después")}
      </div>
      {item.caption && (
        <figcaption className="mt-3 text-sm text-center" style={{ color: p.muted }}>
          {item.caption}
        </figcaption>
      )}
    </figure>
  );
}

export function GalleryLightbox({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const total = items.length;
  const go = useCallback(
    (delta: number) => onIndex((index + delta + total) % total),
    [index, total, onIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [go, onClose]);

  const current = items[index];
  const navBtn =
    "absolute rounded-full p-2.5 text-white/85 bg-white/10 hover:bg-white/20 hover:text-white transition focus-visible:outline-2 focus-visible:outline-white";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Galería de imágenes"
      className="fixed inset-0 z-50 grid place-items-center p-4 motion-safe:animate-in motion-safe:fade-in"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar galería"
        autoFocus
        className={`${navBtn} top-4 right-4`}
      >
        <X className="w-6 h-6" aria-hidden="true" />
      </button>
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Imagen anterior"
            className={`${navBtn} left-2 md:left-6`}
          >
            <ChevronLeft className="w-7 h-7" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Imagen siguiente"
            className={`${navBtn} right-2 md:right-6`}
          >
            <ChevronRight className="w-7 h-7" aria-hidden="true" />
          </button>
        </>
      )}
      <figure className="max-w-full" onClick={(e) => e.stopPropagation()}>
        <img
          src={current.url}
          alt={current.alt || current.caption || `Imagen ${index + 1} de ${total}`}
          className="max-h-[80vh] max-w-full object-contain rounded-xl"
        />
        {(current.caption || total > 1) && (
          <figcaption className="mt-3 flex justify-between gap-4 text-sm text-white/80">
            <span>{current.caption}</span>
            {total > 1 && (
              <span className="tabular-nums shrink-0">
                {index + 1} / {total}
              </span>
            )}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

export function FaqRow({ item, palette }: { item: FaqItem; palette: LandingPalette }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const buttonId = `faq-btn-${uid}`;
  const panelId = `faq-panel-${uid}`;
  return (
    <div
      className="rounded-2xl border transition-colors"
      style={{
        background: palette.surface,
        borderColor: open ? withAlpha(palette.brand, 0.55) : palette.border,
      }}
    >
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 md:py-5 font-semibold text-base md:text-[1.05rem] rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: palette.brand }}
        >
          {item.question}
          <span
            className="grid place-items-center w-8 h-8 shrink-0 rounded-full transition"
            style={{
              background: open ? palette.brand : withAlpha(palette.brand, 0.12),
              color: open ? palette.onBrand : palette.brandText,
            }}
            aria-hidden="true"
          >
            <Plus
              className={`w-4 h-4 motion-safe:transition-transform ${open ? "rotate-45" : ""}`}
            />
          </span>
        </button>
      </h3>
      {/* Se mantiene en el DOM para que la respuesta sea rastreable. */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="px-5 pb-5 -mt-1 text-base leading-relaxed whitespace-pre-line"
        style={{ color: palette.muted }}
      >
        {item.answer}
      </div>
    </div>
  );
}
