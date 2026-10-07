/**
 * Piezas visuales de "Archivos", compartidas por la agencia y el panel del
 * cliente (/mi): ícono por tipo de archivo, miniatura sin recorte, skeleton de
 * la galería, ilustración de vacío, medidor de espacio y chips de filtro.
 * Solo presentación: reciben datos por props, sin E/S.
 */
import type { ComponentType, ReactNode } from "react";
import {
  File,
  FileArchive,
  FileBarChart,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fileExtension, fileTypeLabel } from "./fileType";

/** Cómo se ve el archivo: imagen, video, PDF, página web (reporte) o archivo genérico. */
export type FileVisualMedia = "image" | "video" | "pdf" | "page" | "file";

type IconComponent = ComponentType<{ className?: string }>;

interface TypeStyle {
  icon: IconComponent;
  /** Fondo + color del ícono (tokens de estado o de marca). */
  tone: string;
}

const PDF: TypeStyle = { icon: FileText, tone: "bg-danger-subtle text-danger-strong" };
const DOC: TypeStyle = { icon: FileText, tone: "bg-info-subtle text-info-strong" };
const SHEET: TypeStyle = { icon: FileSpreadsheet, tone: "bg-success-subtle text-success-strong" };
const SLIDES: TypeStyle = { icon: Presentation, tone: "bg-warning-subtle text-warning-strong" };
const ARCHIVE: TypeStyle = { icon: FileArchive, tone: "bg-neutral-subtle text-neutral-strong" };
const IMAGE: TypeStyle = { icon: FileImage, tone: "bg-brand-soft text-brand-1" };
const VIDEO: TypeStyle = { icon: FileVideo, tone: "bg-brand-soft text-brand-1" };
const PAGE: TypeStyle = { icon: FileBarChart, tone: "bg-brand-soft text-brand-1" };
const GENERIC: TypeStyle = { icon: File, tone: "bg-neutral-subtle text-neutral-strong" };

const BY_EXT: Readonly<Record<string, TypeStyle>> = {
  pdf: PDF,
  doc: DOC,
  docx: DOC,
  txt: DOC,
  rtf: DOC,
  xls: SHEET,
  xlsx: SHEET,
  csv: SHEET,
  ppt: SLIDES,
  pptx: SLIDES,
  key: SLIDES,
  zip: ARCHIVE,
  rar: ARCHIVE,
  "7z": ARCHIVE,
};

const BY_MEDIA: Readonly<Record<FileVisualMedia, TypeStyle>> = {
  image: IMAGE,
  video: VIDEO,
  pdf: PDF,
  page: PAGE,
  file: GENERIC,
};

function typeStyle(media: FileVisualMedia, ext: string | null): TypeStyle {
  if (media === "page") return PAGE;
  return (ext && BY_EXT[ext.toLowerCase()]) || BY_MEDIA[media];
}

/** Cuadro de color con el ícono del tipo de archivo (PDF rojo, Excel verde, Word azul…). */
export function FileTypeTile({
  media,
  name,
  url,
  size = "md",
  className,
}: {
  media: FileVisualMedia;
  name: string;
  url?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const ext = fileExtension(name, url);
  const { icon: Icon, tone } = typeStyle(media, ext);
  const label = fileTypeLabel(media, name, url);
  if (size === "lg") {
    return (
      <span
        className={cn(
          "flex h-20 w-16 flex-col items-center justify-center gap-1.5 rounded-app-md shadow-app-xs",
          tone,
          className,
        )}
      >
        <Icon aria-hidden className="h-7 w-7" />
        {label && <span className="text-xs font-semibold tracking-wide">{label}</span>}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-app-md",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </span>
  );
}

/**
 * Miniatura que respeta la proporción de la pieza: la imagen completa
 * (`object-contain`) sobre una copia desenfocada que llena el cuadro, así un
 * post 4:5, una historia 9:16 o un banner 16:9 se ven enteros, sin recortes.
 */
export function FilePreview({
  media,
  name,
  thumbUrl,
  videoUrl,
  className,
}: {
  media: FileVisualMedia;
  name: string;
  thumbUrl: string | null;
  /** Primer archivo del video: se muestra su primer cuadro si no hay portada. */
  videoUrl?: string | null;
  className?: string;
}) {
  if (thumbUrl) {
    return (
      <span className={cn("relative block h-full w-full overflow-hidden", className)}>
        <img
          src={thumbUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl saturate-150"
        />
        <img
          src={thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="relative h-full w-full object-contain drop-shadow-md"
        />
      </span>
    );
  }
  if (media === "video" && videoUrl) {
    return (
      <video
        src={videoUrl}
        muted
        playsInline
        preload="metadata"
        aria-hidden
        className={cn("h-full w-full bg-black object-contain", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--brand-1)_10%,transparent),transparent_60%)]",
        className,
      )}
    >
      <FileTypeTile media={media} name={name} size="lg" />
    </span>
  );
}

/** Galería en carga: tarjetas con la misma proporción que las reales. */
export function GallerySkeleton({
  count = 8,
  label = "Cargando archivos",
  className,
}: {
  count?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-app-lg border border-border-subtle bg-surface"
        >
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-1.5 p-3">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Ilustración de vacío: tres piezas apiladas con el degradado de marca. */
export function FilesEmptyArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      aria-hidden
      className={cn("h-28 w-36", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="files-empty-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-1)" />
          <stop offset="0.6" stopColor="var(--brand-2)" />
          <stop offset="1" stopColor="var(--brand-3)" />
        </linearGradient>
      </defs>
      <rect
        x="22"
        y="26"
        width="56"
        height="70"
        rx="8"
        transform="rotate(-10 50 61)"
        fill="var(--surface-2)"
        stroke="var(--border-strong)"
      />
      <rect
        x="82"
        y="26"
        width="56"
        height="70"
        rx="8"
        transform="rotate(10 110 61)"
        fill="var(--surface-2)"
        stroke="var(--border-strong)"
      />
      <rect
        x="50"
        y="16"
        width="60"
        height="78"
        rx="9"
        fill="var(--surface)"
        stroke="var(--border-strong)"
      />
      <rect x="56" y="22" width="48" height="44" rx="5" fill="url(#files-empty-g)" opacity="0.9" />
      <circle cx="93" cy="33" r="6" fill="white" fillOpacity="0.55" />
      <path d="M56 60l14-14 10 10 8-6 16 14v2H56z" fill="white" fillOpacity="0.45" />
      <rect x="56" y="72" width="34" height="5" rx="2.5" fill="var(--border-strong)" />
      <rect x="56" y="81" width="22" height="4" rx="2" fill="var(--border-subtle)" />
    </svg>
  );
}

/** Estado vacío ilustrado para "Archivos". */
export function FilesEmpty({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-8 text-center md:h-full",
        className,
      )}
    >
      <FilesEmptyArt className="mb-1" />
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

const WARN_RATIO = 0.8;
const FULL_RATIO = 0.95;

/** Medidor del espacio usado (p. ej. "1,4 GB de 5 GB") con barra de marca. */
export function StorageMeter({
  used,
  limit,
  usedLabel,
  limitLabel,
  hint,
  className,
}: {
  used: number;
  limit: number;
  usedLabel: string;
  limitLabel: string;
  /** Línea secundaria (p. ej. "Hasta 200 MB por archivo"). */
  hint?: string;
  className?: string;
}) {
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const percent = Math.round(ratio * 100);
  const bar =
    ratio >= FULL_RATIO ? "bg-danger" : ratio >= WARN_RATIO ? "bg-warning" : "bg-gradient-brand";
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium tabular-nums text-foreground">
          {usedLabel} <span className="font-normal text-muted-foreground">de {limitLabel}</span>
        </span>
        <span className="tabular-nums text-muted-foreground">{percent}%</span>
      </div>
      <div
        role="meter"
        aria-label="Espacio usado"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${usedLabel} de ${limitLabel}`}
        className="h-1.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-border-subtle"
      >
        <div
          className={cn("h-full rounded-full motion-safe:transition-[width]", bar)}
          style={{ width: `${Math.max(ratio > 0 ? 2 : 0, percent)}%` }}
        />
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  count: number;
}

/** Chips de filtro por tipo, con conteo; uno activo a la vez. */
export function FilterChips<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly FilterChipOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors",
              active
                ? "border-transparent bg-brand-soft text-foreground ring-1 ring-inset ring-brand-1/30"
                : "border-border-subtle bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {o.label}
            <span className={cn("tabular-nums", active ? "text-brand-1" : "text-muted-foreground")}>
              {o.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
