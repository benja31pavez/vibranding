import { useEffect, useState } from "react";
import { Check, Share2 } from "lucide-react";

const COPIED_MS = 2200;

/**
 * Compartir la página pública: hoja nativa del teléfono si existe; si no, copia el link.
 * Va sobre la portada, por eso es un círculo de vidrio oscuro con texto blanco.
 */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(t);
  }, [copied]);

  const share = async () => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        // El usuario cerró la hoja: no es un error que mostrar.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copia este link:", url);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void share()}
        aria-label={copied ? "Link copiado" : `Compartir ${title}`}
        title={copied ? "Link copiado" : "Compartir"}
        className="grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-black/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
      >
        {copied ? (
          <Check className="h-[18px] w-[18px]" aria-hidden="true" />
        ) : (
          <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
        )}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Link copiado" : ""}
      </span>
    </>
  );
}
