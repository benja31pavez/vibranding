import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "../ficha/fichaQueries";
import { downloadHref, KIND_LABEL, STATUS_META, type ClientFile } from "./archivosModel";

const STAGE = "max-h-[68vh] w-full rounded-app-md bg-surface-2 object-contain";

function Stage({ file, index }: { file: ClientFile; index: number }) {
  const url = file.urls[index] ?? file.urls[0];
  if (file.media === "video") {
    return (
      <video
        key={url}
        src={url}
        controls
        playsInline
        poster={file.thumbUrl ?? undefined}
        className={STAGE}
      />
    );
  }
  if (file.media === "pdf") {
    return (
      <iframe
        src={`${url}#toolbar=0&navpanes=0`}
        title={file.name}
        className="h-[68vh] w-full rounded-app-md border border-border-subtle bg-surface"
      />
    );
  }
  return <img src={url} alt={file.name} className={STAGE} />;
}

/** Visor: la pieza en grande (láminas del carrusel, video o PDF) con descarga. */
export function FileViewer({ file, onClose }: { file: ClientFile | null; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const slides = file?.urls.length ?? 0;
  const status = file?.status ? STATUS_META[file.status] : null;
  const current = file ? (file.urls[index] ?? file.urls[0]) : "";
  const name = file && slides > 1 ? `${file.name} (${index + 1})` : (file?.name ?? "");

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
                <span>
                  {KIND_LABEL[file.kind]}
                  {file.date && ` · ${formatDate(file.date)}`}
                </span>
                {status && (
                  <StatusBadge status={file.status ?? ""} label={status.label} tone={status.tone} />
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Stage file={file} index={index} />
              {slides > 1 && (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full shadow-app-xs"
                    onClick={() => setIndex((i) => (i - 1 + slides) % slides)}
                    aria-label="Lámina anterior"
                  >
                    <ChevronLeft aria-hidden className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full shadow-app-xs"
                    onClick={() => setIndex((i) => (i + 1) % slides)}
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
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="ghost">
                  <a href={current} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden className="mr-1.5 h-4 w-4" /> Abrir
                  </a>
                </Button>
                <Button asChild size="sm">
                  <a
                    href={downloadHref(current, name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                  >
                    <Download aria-hidden className="mr-1.5 h-4 w-4" /> Descargar
                  </a>
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
