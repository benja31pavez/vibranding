import { useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, FileText, Loader2, Trash2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createOnboardingUploadUrl } from "@/lib/onboarding/public.functions";
import { FILE_ACCEPT, FILE_TYPES, MAX_FILE_BYTES, MAX_FILES } from "@/lib/onboarding/schema";
import { newRowId, type FormState, type UploadedFile } from "../formState";
import type { StepProps } from "./types";

interface FilesProps extends StepProps {
  token: string;
  /** Actualiza la lista de archivos sobre el estado más reciente (las subidas son asíncronas). */
  updateFiles: (fn: (files: FormState["archivos"]) => FormState["archivos"]) => void;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function localCheck(file: File): string | null {
  if (!(file.type in FILE_TYPES)) return "Formato no permitido: usa PNG, JPG, WEBP o PDF.";
  if (file.size <= 0) return "El archivo está vacío.";
  if (file.size > MAX_FILE_BYTES) return "Pesa más de 10 MB.";
  return null;
}

async function uploadOne(token: string, file: File): Promise<{ path: string } | { error: string }> {
  const signed = await createOnboardingUploadUrl({
    data: { token, filename: file.name, contentType: file.type, size: file.size },
  });
  if (!signed.ok) return { error: signed.message };
  const { error } = await supabase.storage
    .from("onboarding")
    .uploadToSignedUrl(signed.path, signed.uploadToken, file, { contentType: file.type });
  if (error) {
    console.error("[onboarding] subida falló", error.message);
    return { error: "No se pudo subir. Revisa tu conexión e intenta de nuevo." };
  }
  return { path: signed.path };
}

/** Paso 5: logo, fotos y PDFs. Cada archivo sube directo a Storage con una URL firmada. */
export function FilesStepFields({ state, errors, token, updateFiles }: FilesProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const active = state.archivos.filter((f) => f.status !== "error").length;
  const uploading = state.archivos.some((f) => f.status === "uploading");

  const setFile = (id: string, patch: Partial<UploadedFile>) =>
    updateFiles((files) => files.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_FILES - active;
    setNotice(
      picked.length > room
        ? `Solo puedes enviar ${MAX_FILES} archivos; subimos los primeros ${Math.max(room, 0)}.`
        : null,
    );
    const queue = picked.slice(0, Math.max(room, 0)).map((file) => {
      const problem = localCheck(file);
      const entry: UploadedFile = {
        id: newRowId(),
        name: file.name,
        size: file.size,
        status: problem ? "error" : "uploading",
        error: problem ?? undefined,
      };
      return { file, entry };
    });
    updateFiles((files) => [...files, ...queue.map((q) => q.entry)]);

    for (const { file, entry } of queue) {
      if (entry.status === "error") continue;
      try {
        const res = await uploadOne(token, file);
        setFile(
          entry.id,
          "path" in res
            ? { status: "done", path: res.path }
            : { status: "error", error: res.error },
        );
      } catch (err) {
        console.error("[onboarding] subida falló", err);
        setFile(entry.id, { status: "error", error: "No se pudo subir. Intenta de nuevo." });
      }
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Sube tu <strong className="text-foreground">logo</strong>,{" "}
        <strong className="text-foreground">fotos</strong> de tus productos, local o equipo, y{" "}
        <strong className="text-foreground">PDFs</strong> útiles (catálogo, manual de marca). PNG,
        JPG, WEBP o PDF, hasta 10 MB cada uno y {MAX_FILES} en total.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        onChange={(e) => void onPick(e)}
        className="sr-only"
        id="onb-files"
        aria-describedby="onb-files-help"
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-24 w-full flex-col gap-1 border-dashed"
        onClick={() => inputRef.current?.click()}
        disabled={active >= MAX_FILES}
      >
        <Upload aria-hidden className="h-5 w-5" />
        <span>{active >= MAX_FILES ? "Llegaste al máximo de archivos" : "Elegir archivos"}</span>
      </Button>
      <p id="onb-files-help" className="text-xs text-muted-foreground">
        {active} de {MAX_FILES} archivos. Si no tienes nada a mano, puedes enviar el formulario
        igual y mandarlos después.
      </p>
      {notice && <p className="text-sm text-warning-strong">{notice}</p>}
      {errors.archivos && <p className="text-sm text-danger-strong">{errors.archivos}</p>}

      {state.archivos.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {state.archivos.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-app-md border border-border-subtle bg-surface px-3 py-2.5"
            >
              {f.status === "uploading" && (
                <Loader2
                  aria-hidden
                  className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                />
              )}
              {f.status === "done" && (
                <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-success" />
              )}
              {f.status === "error" && (
                <XCircle aria-hidden className="h-4 w-4 shrink-0 text-danger-strong" />
              )}
              <FileText
                aria-hidden
                className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{f.name}</p>
                <p
                  className={`text-xs ${f.status === "error" ? "text-danger-strong" : "text-muted-foreground"}`}
                >
                  {f.status === "uploading"
                    ? "Subiendo…"
                    : f.status === "error"
                      ? f.error
                      : `Listo · ${formatSize(f.size)}`}
                </p>
              </div>
              {f.status !== "uploading" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => updateFiles((files) => files.filter((x) => x.id !== f.id))}
                  aria-label={`Quitar ${f.name}`}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {uploading && (
        <p className="text-xs text-muted-foreground">
          Espera a que terminen de subir antes de enviar.
        </p>
      )}
    </div>
  );
}
