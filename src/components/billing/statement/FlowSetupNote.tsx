import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Solo agencia: Flow no está configurado. Explica qué pasa sin enlazar a
 * ninguna página (la configuración es del servidor).
 */
export function FlowSetupNote({ missing }: { missing: string[] | null }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground">
          <Info aria-hidden className="mr-1 h-3.5 w-3.5" />
          Configura Flow
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2 text-sm">
        <p className="font-medium">Pago en línea desactivado</p>
        <p className="text-muted-foreground">
          Mientras Flow no esté configurado, el botón Pagar queda deshabilitado. Puedes cobrar por
          transferencia y marcar el cobro como pagado. Flow lo conecta un administrador de la
          plataforma en la configuración del servidor.
        </p>
        {missing && missing.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Detalle para administradores: falta {missing.join(", ")}.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
