import { useState } from "react";
import { Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INTRO_MAX_CHARS } from "@/lib/proposals/recommend";
import { publicProposalUrl } from "./proposalQueries";

interface Props {
  /** Texto generado por plantilla (cambia si cambia el plan elegido). */
  generated: string;
  /** Token público, si la propuesta ya existe. */
  linkToken: string | null;
  /** En borrador el link aún no abre (se activa al marcarla enviada). */
  linkIsDraft: boolean;
}

async function copy(text: string, ok: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error("Tu navegador no permitió copiar. Selecciona el texto y cópialo a mano.");
  }
}

/**
 * Mensaje de presentación para enviar junto al link (WhatsApp o correo).
 * No se guarda en la BD: se arma de nuevo desde los datos del prospecto.
 */
export function ProposalIntroPanel({ generated, linkToken, linkIsDraft }: Props) {
  // Sin edición manual, el texto sigue al plan elegido.
  const [override, setOverride] = useState<string | null>(null);
  const text = override ?? generated;
  const edited = override !== null;
  const reset = () => setOverride(null);

  return (
    <Panel
      title="Mensaje de presentación"
      description="Armado con los datos del prospecto. No se guarda: cópialo al enviar el link."
    >
      <div className="space-y-2">
        <Label htmlFor="proposal-intro" className="sr-only">
          Mensaje de presentación
        </Label>
        <Textarea
          id="proposal-intro"
          rows={6}
          maxLength={INTRO_MAX_CHARS}
          value={text}
          onChange={(e) => setOverride(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void copy(text, "Mensaje copiado")}>
            <Copy aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Copiar mensaje
          </Button>
          {linkToken && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void copy(
                  `${text}\n\n${publicProposalUrl(linkToken)}`,
                  linkIsDraft ? "Copiado. El link funcionará cuando marques la propuesta como enviada." : "Mensaje con link copiado",
                )
              }
            >
              <Copy aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Copiar con link
            </Button>
          )}
          {edited && (
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              <RotateCcw aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Volver al texto sugerido
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}
