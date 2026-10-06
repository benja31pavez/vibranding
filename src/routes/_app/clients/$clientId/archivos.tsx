import { createFileRoute } from "@tanstack/react-router";
import { ArchivosPage } from "@/components/clients/archivos/ArchivosPage";

/** Archivos del cliente: piezas gráficas y documentos generados, y lo que subió el cliente. */
export const Route = createFileRoute("/_app/clients/$clientId/archivos")({
  head: () => ({
    meta: [
      { title: "Archivos del cliente | Vibranding" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ArchivosRoute,
});

function ArchivosRoute() {
  const { clientId } = Route.useParams();
  return <ArchivosPage clientId={clientId} />;
}
