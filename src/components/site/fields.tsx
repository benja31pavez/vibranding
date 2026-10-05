import { useId, useState } from "react";
import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { uploadClientMedia } from "@/lib/uploadMedia";

/**
 * Campo con etiqueta, ayuda, error accesible y aviso de "texto de ejemplo".
 * `children` recibe el id y los atributos aria para conectarlos al input.
 */
export function Field({
  label,
  hint,
  error,
  example,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  /** Muestra que el valor viene de una plantilla y hay que reemplazarlo. */
  example?: boolean;
  children: (a11y: {
    id: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5 min-w-0">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {example && !error && <ExampleBadge />}
      {hint && !error && (
        <p id={hintId} className="text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function ExampleBadge({
  text = "Texto de ejemplo: reemplázalo con datos reales del cliente",
}: {
  text?: string;
}) {
  return (
    <p className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
      <Sparkles className="h-3 w-3" aria-hidden="true" /> {text}
    </p>
  );
}

/** Botón para subir una imagen al storage del cliente. */
export function ImageUploadButton({
  clientId,
  label,
  multiple,
  onUploaded,
}: {
  clientId: string;
  label: string;
  multiple?: boolean;
  onUploaded: (urls: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const urls = await Promise.all(files.map((f) => uploadClientMedia(f, clientId)));
      onUploaded(urls);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  };
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary focus-within:ring-2 focus-within:ring-ring">
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <ImagePlus className="h-4 w-4" aria-hidden="true" />
      )}
      {busy ? "Subiendo…" : label}
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        className="sr-only"
        onChange={onChange}
        disabled={busy}
      />
    </label>
  );
}
