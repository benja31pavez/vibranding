import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, ExternalLink, Layers, Loader2, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FilePreview, FileTypeTile, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/clientFiles/clientFiles";
import { getOnboardingFileUrl } from "@/lib/onboarding/intake.functions";
import { formatDate } from "../ficha/fichaQueries";
import {
  downloadHref,
  isViewable,
  KIND_LABEL,
  STATUS_META,
  type ClientFile,
  type UploadedFile,
} from "./archivosModel";

const ICON_BUTTON = "h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground";
const DELETE_BUTTON = "h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive";
const ROW =
  "flex min-w-0 items-center gap-3 rounded-app-md px-2 py-2 motion-safe:transition-colors hover:bg-surface-2/70";

/** Eliminar: solo en archivos subidos en "Archivos" que el usuario puede borrar. */
function DeleteButton({ file, onDelete }: { file: ClientFile; onDelete?: () => void }) {
  if (!onDelete || !file.stored?.canDelete) return null;
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={DELETE_BUTTON}
      onClick={onDelete}
      aria-label={`Eliminar ${file.name}`}
      title="Eliminar"
    >
      <Trash2 aria-hidden className="h-4 w-4" />
    </Button>
  );
}

function DownloadButton({ file }: { file: ClientFile }) {
  if (file.media === "page") return null;
  return (
    <Button asChild size="icon" variant="ghost" className={ICON_BUTTON}>
      <a
        href={downloadHref(file.urls[0], file.name)}
        target="_blank"
        rel="noopener noreferrer"
        download
        aria-label={`Descargar ${file.name}`}
        title="Descargar"
      >
        <Download aria-hidden className="h-4 w-4" />
      </a>
    </Button>
  );
}

const SHORT_DATE = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  timeZone: "America/Santiago",
});

/** "9 oct" este año; "9 oct 2025" otros años. */
function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.getFullYear() === new Date().getFullYear()
    ? SHORT_DATE.format(date).replace(".", "")
    : formatDate(value);
}

/** "Post · 9 oct · 2,4 MB". */
function metaLine(file: ClientFile): string {
  const parts = [
    KIND_LABEL[file.kind],
    file.date ? shortDate(file.date) : "",
    file.size ? formatBytes(file.size) : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

function FileStatusBadge({ file, className }: { file: ClientFile; className?: string }) {
  const status = file.status ? STATUS_META[file.status] : null;
  if (!status) return null;
  return (
    <StatusBadge
      status={file.status ?? ""}
      label={status.label}
      tone={status.tone}
      className={className}
    />
  );
}

/** Línea del visor: tipo, fecha, peso y estado. */
export function FileMeta({ file }: { file: ClientFile }) {
  return (
    <>
      <span className="text-muted-foreground">{metaLine(file)}</span>
      <FileStatusBadge file={file} />
    </>
  );
}

interface FileItemProps {
  file: ClientFile;
  onView: () => void;
  /** Solo se muestra si el archivo es propio (file.stored.canDelete). */
  onDelete?: () => void;
}

/** Marca de la esquina: video o cantidad de láminas del carrusel. */
function CornerMark({ file }: { file: ClientFile }) {
  const slides = file.urls.length;
  if (slides > 1) {
    return (
      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
        <Layers aria-hidden className="h-3 w-3" />
        {slides}
        <span className="sr-only"> láminas</span>
      </span>
    );
  }
  if (file.media === "video") {
    return (
      <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur">
        <Play aria-hidden className="ml-px h-3.5 w-3.5 fill-current" />
        <span className="sr-only">Video</span>
      </span>
    );
  }
  return null;
}

/**
 * Tarjeta de la galería: la pieza completa (sin recortes, en su proporción), estado,
 * nombre, tipo, fecha y acciones. La miniatura abre el visor.
 */
export function GalleryCard({ file, onView, onDelete }: FileItemProps) {
  return (
    <article className="card-brand group flex h-full min-w-0 flex-col overflow-hidden rounded-app-lg border border-border-subtle bg-surface shadow-app-xs">
      <button
        type="button"
        onClick={onView}
        aria-label={`Ver ${file.name}`}
        className="relative aspect-square w-full overflow-hidden bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="block h-full w-full motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]">
          <FilePreview
            media={file.media}
            name={file.name}
            thumbUrl={file.thumbUrl}
            videoUrl={file.urls[0]}
          />
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 opacity-0 group-hover:bg-black/15 group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:transition-all"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-neutral-900 shadow-app-md">
            <Eye className="h-4 w-4" />
          </span>
        </span>
        <FileStatusBadge file={file} className="absolute left-2 top-2 shadow-app-xs" />
        <CornerMark file={file} />
      </button>
      <div className="flex min-w-0 items-center gap-1 py-2 pl-3 pr-1.5">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-ui font-medium text-foreground" title={file.name}>
            {file.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{metaLine(file)}</p>
        </div>
        <DownloadButton file={file} />
        <DeleteButton file={file} onDelete={onDelete} />
      </div>
    </article>
  );
}

/** Ícono o miniatura de una fila (las imágenes muestran su miniatura). */
function RowThumb({ file }: { file: ClientFile }) {
  if (file.thumbUrl) {
    return (
      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-app-md border border-border-subtle bg-surface-2">
        <img
          src={file.thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return <FileTypeTile media={file.media} name={file.name} url={file.urls[0]} />;
}

function ViewAction({ file, onView }: FileItemProps) {
  if (file.media === "page") {
    return (
      <Button asChild size="sm" variant="outline" className="h-8 shrink-0 px-2.5 text-xs">
        <a href={file.urls[0]} target="_blank" rel="noopener noreferrer">
          Abrir <ExternalLink aria-hidden className="ml-1 h-3.5 w-3.5" />
          <span className="sr-only"> {file.name} (se abre en otra pestaña)</span>
        </a>
      </Button>
    );
  }
  if (!isViewable(file)) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 shrink-0 px-2.5 text-xs"
      onClick={onView}
    >
      <Eye aria-hidden className="mr-1 h-3.5 w-3.5" />
      Ver<span className="sr-only"> {file.name}</span>
    </Button>
  );
}

/** Fila: reportes, PDF, documentos y archivos subidos (también la galería en "Ver todos"). */
export function DocumentRow({
  file,
  onView,
  onDelete,
  compact = false,
}: FileItemProps & { compact?: boolean }) {
  return (
    <div className={ROW}>
      <RowThumb file={file} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-foreground" title={file.name}>
          {file.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{metaLine(file)}</p>
      </div>
      {!compact && <FileStatusBadge file={file} className="hidden sm:inline-flex" />}
      {/* Columnas fijas: las acciones quedan alineadas entre filas. */}
      <span className="flex shrink-0 items-center justify-end sm:w-[76px]">
        <ViewAction file={file} onView={onView} />
      </span>
      <span className="flex w-8 shrink-0 justify-center empty:hidden sm:empty:block">
        <DownloadButton file={file} />
      </span>
      {onDelete && (
        <span className="flex w-8 shrink-0 justify-center empty:hidden sm:empty:block">
          <DeleteButton file={file} onDelete={onDelete} />
        </span>
      )}
    </div>
  );
}

/** Archivo del onboarding: la URL firmada (5 min) se pide al descargar. */
export function UploadRow({ clientId, file }: { clientId: string; file: UploadedFile }) {
  const getUrl = useServerFn(getOnboardingFileUrl);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const { url } = await getUrl({ data: { clientId, path: file.path } });
      // La URL firmada fuerza la descarga: la página no cambia.
      window.location.assign(url);
    } catch (e) {
      toast.error((e as Error).message || "No pudimos preparar la descarga");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={ROW}>
      <FileTypeTile media={file.media} name={file.name} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-foreground" title={file.name}>
          {file.name}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-px font-medium text-foreground ring-1 ring-inset ring-border-subtle">
            Onboarding
          </span>
          <span className="truncate">{file.date && formatDate(file.date)}</span>
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 shrink-0 px-2.5 text-xs"
        onClick={() => void download()}
        disabled={busy}
      >
        {busy ? (
          <Loader2 aria-hidden className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download aria-hidden className="mr-1 h-3.5 w-3.5" />
        )}
        Descargar<span className="sr-only"> {file.name}</span>
      </Button>
    </div>
  );
}
