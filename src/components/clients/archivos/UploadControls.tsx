import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { CloudUpload, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CLIENT_FILE_ACCEPT } from "@/lib/clientFiles/clientFiles";
import { cn } from "@/lib/utils";
import type { UploadProgress } from "./archivosQueries";

/** Texto de los límites, igual en el botón, la zona de arrastre y el estado vacío. */
export const UPLOAD_LIMITS_HINT = "Imágenes, videos, PDF u Office · hasta 200 MB por archivo";

/** Selector de archivos oculto + botón "Subir archivos". */
export function UploadButton({
  busy,
  onFiles,
  variant = "default",
  label = "Subir archivos",
}: {
  busy: boolean;
  onFiles: (files: File[]) => void;
  variant?: "default" | "outline";
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length > 0) onFiles(picked);
  };
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={CLIENT_FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onPick}
      />
      <Button
        type="button"
        size="sm"
        variant={variant}
        className="h-9"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        title={UPLOAD_LIMITS_HINT}
      >
        {busy ? (
          <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Upload aria-hidden className="mr-1.5 h-4 w-4" />
        )}
        {busy ? "Subiendo…" : label}
      </Button>
    </>
  );
}

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

/**
 * Zona de arrastrar y soltar sobre la lista: al arrastrar archivos encima
 * aparece un aviso de marca; al soltarlos se suben. Desactivada sin permiso.
 */
export function DropZone({
  enabled,
  busy,
  onFiles,
  children,
  className,
}: {
  enabled: boolean;
  busy: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  if (!enabled) return <div className={className}>{children}</div>;

  const reset = () => {
    depth.current = 0;
    setOver(false);
  };
  return (
    <div
      className={cn("relative", className)}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = busy ? "none" : "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        reset();
        const files = Array.from(e.dataTransfer.files);
        if (!busy && files.length > 0) onFiles(files);
      }}
    >
      {children}
      {over && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-app-lg border-2 border-dashed border-brand-1/60 bg-surface/90 text-center backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand-1">
            <CloudUpload className="h-7 w-7" />
          </span>
          <p className="text-base font-semibold text-foreground">
            {busy ? "Espera a que termine la subida" : "Suelta para subir"}
          </p>
          <p className="text-sm text-muted-foreground">{UPLOAD_LIMITS_HINT}</p>
        </div>
      )}
    </div>
  );
}

/** Franja de avance mientras se suben archivos: "Subiendo 2 de 5 · foto.jpg". */
export function UploadProgressBar({ progress }: { progress: UploadProgress | null }) {
  if (!progress) return null;
  const percent = Math.round(((progress.current - 0.5) / progress.total) * 100);
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-center gap-3 rounded-app-md border border-border-subtle bg-surface px-3 py-2 shadow-app-xs"
    >
      <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-brand-1" />
      <p className="min-w-0 flex-1 truncate text-xs">
        <span className="font-medium tabular-nums text-foreground">
          Subiendo {progress.current} de {progress.total}
        </span>
        <span className="text-muted-foreground"> · {progress.name}</span>
      </p>
      <div
        aria-hidden
        className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-surface-2 sm:w-48"
      >
        <div
          className="h-full rounded-full bg-gradient-brand motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
