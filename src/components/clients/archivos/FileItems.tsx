import { useState, type ComponentType } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  ExternalLink,
  FileBarChart,
  FileText,
  Film,
  ImageIcon,
  Layers,
  Loader2,
  Paperclip,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { getOnboardingFileUrl } from "@/lib/onboarding/intake.functions";
import { formatDate } from "../ficha/fichaQueries";
import {
  downloadHref,
  KIND_LABEL,
  STATUS_META,
  type ClientFile,
  type FileMedia,
  type UploadedFile,
} from "./archivosModel";

type IconComponent = ComponentType<{ className?: string }>;

const MEDIA_ICON: Readonly<Record<FileMedia, IconComponent>> = {
  image: ImageIcon,
  video: Film,
  pdf: FileText,
  page: FileBarChart,
  file: Paperclip,
};

const ICON_BUTTON = "h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground";

/** Miniatura: imagen, primer cuadro del video o ícono del tipo de archivo. */
export function FileThumb({ file }: { file: ClientFile }) {
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
  if (file.media === "video") {
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

function metaLine(file: ClientFile): string {
  const date = file.date ? shortDate(file.date) : "";
  return date ? `${KIND_LABEL[file.kind]} · ${date}` : KIND_LABEL[file.kind];
}

/** Tarjeta de la galería: miniatura (abre el visor), nombre, tipo, fecha, estado y descarga. */
export function GalleryCard({ file, onView }: { file: ClientFile; onView: () => void }) {
  const status = file.status ? STATUS_META[file.status] : null;
  const slides = file.urls.length;
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-app-md border border-border-subtle bg-surface shadow-app-xs">
      <button
        type="button"
        onClick={onView}
        aria-label={`Ver ${file.name}`}
        className="group relative aspect-[4/3] overflow-hidden bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="block h-full w-full transition-transform duration-300 group-hover:scale-[1.03]">
          <FileThumb file={file} />
        </span>
        {status && (
          <StatusBadge
            status={file.status ?? ""}
            label={status.label}
            tone={status.tone}
            className="absolute left-2 top-2 shadow-app-xs"
          />
        )}
        {file.media === "video" && (
          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white">
            <Play aria-hidden className="h-3 w-3 fill-current" />
          </span>
        )}
        {slides > 1 && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">
            <Layers aria-hidden className="h-3 w-3" />
            {slides}
            <span className="sr-only"> láminas</span>
          </span>
        )}
      </button>
      <div className="flex min-w-0 items-center gap-1 py-2 pl-3 pr-1.5">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{metaLine(file)}</p>
        </div>
        <DownloadButton file={file} />
      </div>
    </article>
  );
}

/** Fila de la vista "Documentos": reportes y PDF. */
export function DocumentRow({ file, onView }: { file: ClientFile; onView: () => void }) {
  const Icon = MEDIA_ICON[file.media];
  const status = file.status ? STATUS_META[file.status] : null;
  return (
    <div className="flex min-w-0 items-center gap-3 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-app-md bg-surface-2">
        <Icon aria-hidden className="h-4 w-4 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{metaLine(file)}</p>
      </div>
      {status && (
        <StatusBadge
          status={file.status ?? ""}
          label={status.label}
          tone={status.tone}
          className="hidden sm:inline-flex"
        />
      )}
      {file.media === "page" ? (
        <Button asChild size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs">
          <a href={file.urls[0]} target="_blank" rel="noopener noreferrer">
            Ver <ExternalLink aria-hidden className="ml-1 h-3.5 w-3.5" />
            <span className="sr-only"> {file.name} (se abre en otra pestaña)</span>
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={onView}
        >
          Ver<span className="sr-only"> {file.name}</span>
        </Button>
      )}
      <DownloadButton file={file} />
    </div>
  );
}

/** Archivo del onboarding: la URL firmada (5 min) se pide al descargar. */
export function UploadRow({ clientId, file }: { clientId: string; file: UploadedFile }) {
  const getUrl = useServerFn(getOnboardingFileUrl);
  const [busy, setBusy] = useState(false);
  const Icon = MEDIA_ICON[file.media];

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
    <div className="flex min-w-0 items-center gap-3 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-app-md bg-surface-2">
        <Icon aria-hidden className="h-4 w-4 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {file.date ? `Onboarding · ${formatDate(file.date)}` : "Onboarding"}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 px-2 text-xs"
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
