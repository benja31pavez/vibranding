import { ArrowLeft, Eye } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AGENCY_HOME } from "@/lib/auth/clientPanel";

/**
 * Franja fija de la vista previa de la agencia ("Ver como cliente"). Todo lo
 * de abajo es solo lectura. "Volver" regresa a la página anterior (la gestión
 * del cliente) o, si se abrió directo, al inicio de la agencia.
 */
export function PreviewBanner() {
  const navigate = useNavigate();
  const back = () => {
    if (window.history.length > 1) window.history.back();
    else void navigate({ to: AGENCY_HOME });
  };
  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-center gap-3 border-b border-brand-1/20 bg-brand-soft px-4 py-1.5 text-sm text-foreground"
    >
      <Eye aria-hidden className="h-4 w-4 shrink-0 text-brand-1" />
      <span className="min-w-0 truncate font-medium">Vista previa: así lo ve el cliente</span>
      <span className="hidden text-muted-foreground sm:inline">· Solo lectura</span>
      <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={back}>
        <ArrowLeft aria-hidden className="mr-1 h-3.5 w-3.5" /> Volver
      </Button>
    </div>
  );
}
