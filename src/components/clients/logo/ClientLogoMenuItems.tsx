import type { RefObject } from "react";
import { ImageUp, Instagram, RefreshCw } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LOGO_TYPES } from "@/lib/clients/logo";

interface ClientLogoMenuItemsProps {
  /** El logo actual se subió a mano: se ofrece volver a Instagram. */
  manual: boolean;
  disabled: boolean;
  busy: boolean;
  onRefresh: () => void;
  onReset: () => void;
  onUploadClick: () => void;
}

/** Ítems del menú "⋯" de la gestión: logo desde Instagram o subido a mano. */
export function ClientLogoMenuItems({
  manual,
  disabled,
  busy,
  onRefresh,
  onReset,
  onUploadClick,
}: ClientLogoMenuItemsProps) {
  return (
    <>
      {manual ? (
        <DropdownMenuItem disabled={disabled || busy} onSelect={onReset}>
          <Instagram aria-hidden className="mr-2 h-4 w-4" /> Volver a usar Instagram
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem disabled={disabled || busy} onSelect={onRefresh}>
          <RefreshCw aria-hidden className="mr-2 h-4 w-4" />
          {busy ? "Actualizando logo…" : "Actualizar logo desde Instagram"}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem disabled={disabled || busy} onSelect={onUploadClick}>
        <ImageUp aria-hidden className="mr-2 h-4 w-4" /> Subir logo…
      </DropdownMenuItem>
    </>
  );
}

/**
 * Selector de archivo oculto. Va FUERA del menú: el menú se desmonta al
 * cerrarse y el input tiene que seguir montado para recibir el archivo.
 */
export function LogoFileInput({
  inputRef,
  onFile,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={LOGO_TYPES.join(",")}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) onFile(file);
      }}
    />
  );
}
