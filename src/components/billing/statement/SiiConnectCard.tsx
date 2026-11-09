import { ExternalLink, FileSignature } from "lucide-react";
import { EmptyState, Panel } from "@/components/app";

/**
 * Tarjeta "Conectar con SII": estructura preparada para emitir boletas y
 * facturas electrónicas desde la plataforma. Hoy es solo una promesa honesta:
 * la conexión real requiere certificado digital del cliente y no está
 * implementada.
 */
export function SiiConnectCard() {
  return (
    <Panel
      title="Conectar con SII"
      icon={FileSignature}
      description="Facturación electrónica (requiere certificado digital por empresa)."
    >
      <EmptyState
        size="compact"
        icon={FileSignature}
        title="Próximamente"
        description="Podrás vincular tu certificado digital para emitir boletas y facturas electrónicas desde aquí. Mientras tanto, se emiten en el portal del SII."
        action={
          <a
            href="https://www.sii.cl/factura_electronica/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Ir a sii.cl/factura_electronica
            <ExternalLink aria-hidden className="h-3 w-3" />
          </a>
        }
      />
    </Panel>
  );
}
