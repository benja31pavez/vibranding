import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalView, type PortalMode } from "@/components/portal";
import { useActiveClient } from "@/contexts/ActiveClientContext";

export const Route = createFileRoute("/_app/clients/$clientId/portal-preview")({
  head: () => ({
    meta: [
      { title: "Vista previa del portal | Vibranding" },
      { name: "description", content: "Así ve el cliente su portal de Vibranding (solo lectura)." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalPreviewPage,
});

/**
 * Vista previa del portal para el equipo: mismos componentes que /portal, con
 * los datos del cliente leídos con los permisos de agencia y sin acciones.
 */
function PortalPreviewPage() {
  const { clientId } = Route.useParams();
  const { client } = useActiveClient();
  const mode: PortalMode = { kind: "preview", clientId };

  return (
    <div className="space-y-5">
      <div
        role="note"
        className="flex flex-wrap items-center gap-3 rounded-app-lg border border-info/30 bg-info-subtle px-4 py-3 text-sm text-info-strong"
      >
        <Eye aria-hidden className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">
            Vista previa del portal{client?.name ? ` de ${client.name}` : ""}.
          </span>{" "}
          Así lo ve el cliente. Es solo lectura: aprobar, pedir cambios y pagar están desactivados.
        </p>
        <Button asChild size="sm" variant="outline" className="bg-surface">
          <Link to="/clients/$clientId" params={{ clientId }}>
            <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" /> Volver a la ficha
          </Link>
        </Button>
      </div>
      <div className="mx-auto max-w-3xl md:max-w-5xl">
        <PortalView mode={mode} />
      </div>
    </div>
  );
}
