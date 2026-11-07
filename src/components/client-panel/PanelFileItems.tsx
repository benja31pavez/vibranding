import { Download, ExternalLink, Eye, Layers, Play } from "lucide-react";
import {
  FileLightbox,
  FilePreview,
  FileTypeTile,
  StatusBadge,
  type StatusTone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  FILE_KIND_LABEL,
  FILE_STATUS_LABEL,
  fileDownloadHref,
  isSignedStorageUrl,
  type PanelFile,
  type PanelFileStatus,
} from "@/lib/client-panel/model";
import { isPanelViewable } from "./panelFiles";

const STATUS_TONE: Readonly<Record<PanelFileStatus, StatusTone>> = {
  pending: "warning",
  changes: "warning",
  approved: "info",
  published: "success",
};

const SHORT_DATE = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  timeZone: "America/Santiago",
});
const LONG_DATE = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Santiago",
});

/** "9 oct" este año; "9 oct 2025" otros años. */
function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const fmt = date.getFullYear() === new Date().getFullYear() ? SHORT_DATE : LONG_DATE;
  return fmt.format(date).replace(".", "");
}

function metaLine(file: PanelFile): string {
  const date = file.date ? shortDate(file.date) : "";
  return date ? `${FILE_KIND_LABEL[file.kind]} · ${date}` : FILE_KIND_LABEL[file.kind];
}

function FileStatus({ file, className }: { file: PanelFile; className?: string }) {
  if (!file.status) return null;
  return (
    <StatusBadge
      status={file.status}
      label={FILE_STATUS_LABEL[file.status]}
      tone={STATUS_TONE[file.status]}
      className={className}
    />
  );
}

function DownloadLink({ file }: { file: PanelFile }) {
  if (file.media === "page" || !file.urls[0]) return null;
  return (
    <Button
      asChild
      size="icon"
      variant="ghost"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
    >
      <a
        href={fileDownloadHref(file.urls[0], file.name)}
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

function CornerMark({ file }: { file: PanelFile }) {
  if (file.urls.length > 1) {
    return (
      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
        <Layers aria-hidden className="h-3 w-3" />
        {file.urls.length}
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

/** Tarjeta de la galería: la pieza completa (sin recortes), estado, nombre, tipo y fecha. */
export function PanelGalleryCard({ file, onView }: { file: PanelFile; onView: () => void }) {
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
        <FileStatus file={file} className="absolute left-2 top-2 shadow-app-xs" />
        <CornerMark file={file} />
      </button>
      <div className="flex min-w-0 items-center gap-1 py-2 pl-3 pr-1.5">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-ui font-medium text-foreground" title={file.name}>
            {file.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{metaLine(file)}</p>
        </div>
        <DownloadLink file={file} />
      </div>
    </article>
  );
}

function RowThumb({ file }: { file: PanelFile }) {
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

function RowAction({ file, onView }: { file: PanelFile; onView: () => void }) {
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
  if (!isPanelViewable(file)) return null;
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

/** Fila de documento: ícono por tipo, nombre, tipo y fecha; ver o abrir y descargar. */
export function PanelDocumentRow({
  file,
  onView,
  compact = false,
}: {
  file: PanelFile;
  onView: () => void;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-app-md px-2 py-2 hover:bg-surface-2/70 motion-safe:transition-colors">
      <RowThumb file={file} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-foreground" title={file.name}>
          {file.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{metaLine(file)}</p>
      </div>
      {!compact && <FileStatus file={file} className="hidden sm:inline-flex" />}
      {/* Columnas fijas: las acciones quedan alineadas entre filas. */}
      <span className="flex shrink-0 items-center justify-end sm:w-[76px]">
        <RowAction file={file} onView={onView} />
      </span>
      <span className="flex w-8 shrink-0 justify-center empty:hidden sm:empty:block">
        <DownloadLink file={file} />
      </span>
    </div>
  );
}

/** Visor del panel: solo incrusta PDF de NUESTRO Storage con URL firmada; lo externo se abre aparte. */
export function PanelFileViewer({
  files,
  index,
  onIndexChange,
  onClose,
}: {
  files: readonly PanelFile[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <FileLightbox
      items={files}
      index={index}
      onIndexChange={onIndexChange}
      onClose={onClose}
      renderMeta={(f) => (
        <>
          <span className="text-muted-foreground">{metaLine(f)}</span>
          <FileStatus file={f} />
        </>
      )}
      downloadHref={fileDownloadHref}
      canEmbedPdf={isSignedStorageUrl}
    />
  );
}
