import { useState, type ComponentType } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  File,
  FileText,
  Globe,
  ImageIcon,
  Video,
} from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FILE_KIND_LABEL,
  FILE_STATUS_LABEL,
  fileDownloadHref,
  isSignedStorageUrl,
  type PanelFile,
  type PanelFileMedia,
  type PanelFileStatus,
} from "@/lib/client-panel/model";

const MEDIA_ICON: Readonly<Record<PanelFileMedia, ComponentType<{ className?: string }>>> = {
  image: ImageIcon,
  video: Video,
  pdf: FileText,
  page: Globe,
  file: File,
};

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

function FileStatus({ file }: { file: PanelFile }) {
  if (!file.status) return null;
  return (
    <StatusBadge
      status={file.status}
      label={FILE_STATUS_LABEL[file.status]}
      tone={STATUS_TONE[file.status]}
      className="px-1.5 py-px text-[11px] leading-4"
    />
  );
}

function FileThumb({ file }: { file: PanelFile }) {
  if (file.thumbUrl) {
    return (
      <img
        src={file.thumbUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    );
  }
  if (file.media === "video" && file.urls[0]) {
    return (
      <video
        src={file.urls[0]}
        muted
        playsInline
        preload="metadata"
        aria-hidden
        className="h-full w-full object-cover"
      />
    );
  }
  const Icon = MEDIA_ICON[file.media];
  return (
    <span className="grid h-full w-full place-items-center">
      <Icon aria-hidden className="h-6 w-6 text-muted-foreground" />
    </span>
  );
}

function DownloadLink({ file }: { file: PanelFile }) {
  if (file.media === "page" || !file.urls[0]) return null;
  return (
    <Button asChild size="icon" variant="ghost" className="h-8 w-8 shrink-0">
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

/** Tarjeta de la galería: miniatura (abre el visor), nombre, tipo y fecha. Solo lectura. */
export function PanelGalleryCard({ file, onView }: { file: PanelFile; onView: () => void }) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-app-md border border-border-subtle bg-surface shadow-app-xs">
      <button
        type="button"
        onClick={onView}
        aria-label={`Ver ${file.name}`}
        className="relative aspect-square w-full overflow-hidden bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <FileThumb file={file} />
        {file.status && (
          <span className="absolute left-1.5 top-1.5">
            <FileStatus file={file} />
          </span>
        )}
      </button>
      <div className="flex items-center gap-1 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{metaLine(file)}</p>
        </div>
        <DownloadLink file={file} />
      </div>
    </div>
  );
}

/** Fila de documento: ícono, nombre, tipo y fecha; abrir y descargar. Solo lectura. */
export function PanelDocumentRow({ file, onView }: { file: PanelFile; onView: () => void }) {
  const Icon = MEDIA_ICON[file.media];
  const isPage = file.media === "page";
  return (
    <div className="flex min-w-0 items-center gap-3 px-1 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-app-md bg-surface-2">
        {file.thumbUrl ? <FileThumb file={file} /> : <Icon aria-hidden className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        {isPage ? (
          <a
            href={file.urls[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium hover:underline"
          >
            {file.name}
          </a>
        ) : (
          <button
            type="button"
            onClick={onView}
            className="block max-w-full truncate text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {file.name}
          </button>
        )}
        <p className="truncate text-xs text-muted-foreground">{metaLine(file)}</p>
      </div>
      <FileStatus file={file} />
      {isPage ? (
        <Button asChild size="icon" variant="ghost" className="h-8 w-8 shrink-0">
          <a
            href={file.urls[0]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir ${file.name}`}
            title="Abrir"
          >
            <ExternalLink aria-hidden className="h-4 w-4" />
          </a>
        </Button>
      ) : (
        <DownloadLink file={file} />
      )}
    </div>
  );
}

function Stage({ file, url }: { file: PanelFile; url: string }) {
  const box = "max-h-[65vh] w-full rounded-app-md bg-surface-2 object-contain";
  if (file.media === "video") return <video src={url} controls playsInline className={box} />;
  if (file.media === "image") return <img src={url} alt={file.name} className={box} />;
  // Solo se incrustan PDF de NUESTRO Storage con URL firmada; lo externo se abre aparte.
  if (file.media === "pdf" && isSignedStorageUrl(url)) {
    return <iframe src={url} title={file.name} className="h-[65vh] w-full rounded-app-md border" />;
  }
  const Icon = MEDIA_ICON[file.media];
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-app-md bg-surface-2">
      <Icon aria-hidden className="h-10 w-10 text-muted-foreground" />
      <Button asChild size="sm" variant="outline">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden className="mr-1.5 h-4 w-4" /> Abrir en una pestaña nueva
        </a>
      </Button>
    </div>
  );
}

/** Visor: imagen, video o PDF en grande (láminas de carrusel con flechas), abrir y descargar. */
export function PanelFileViewer({
  file,
  onClose,
}: {
  file: PanelFile | null;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const slides = file?.urls.length ?? 0;
  const current = file ? (file.urls[index] ?? file.urls[0] ?? "") : "";
  const name = file && slides > 1 ? `${file.name} (${index + 1})` : (file?.name ?? "");
  const step = (delta: number) => setIndex((i) => (i + delta + slides) % slides);

  return (
    <Dialog
      open={file !== null}
      onOpenChange={(open) => {
        if (open) return;
        setIndex(0);
        onClose();
      }}
    >
      <DialogContent className="max-w-4xl gap-3">
        {file && (
          <>
            <DialogHeader className="space-y-1 pr-8 text-left">
              <DialogTitle className="truncate">{file.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <span>{metaLine(file)}</span>
                <FileStatus file={file} />
              </DialogDescription>
            </DialogHeader>
            <div className="relative">
              {current && <Stage file={file} url={current} />}
              {slides > 1 && (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full shadow-app-xs"
                    onClick={() => step(-1)}
                    aria-label="Lámina anterior"
                  >
                    <ChevronLeft aria-hidden className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full shadow-app-xs"
                    onClick={() => step(1)}
                    aria-label="Lámina siguiente"
                  >
                    <ChevronRight aria-hidden className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                {slides > 1 ? `Lámina ${index + 1} de ${slides}` : ""}
              </p>
              {current && (
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="ghost">
                    <a href={current} target="_blank" rel="noopener noreferrer">
                      <ExternalLink aria-hidden className="mr-1.5 h-4 w-4" /> Abrir
                    </a>
                  </Button>
                  <Button asChild size="sm">
                    <a
                      href={fileDownloadHref(current, name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      <Download aria-hidden className="mr-1.5 h-4 w-4" /> Descargar
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
