import { createFileRoute } from "@tanstack/react-router";
import { ClientFichaPage } from "@/components/clients/ficha/cliente/ClientFichaPage";

/** Resumen del cliente (ítem "Resumen" del panel izquierdo): lo que el cliente también puede ver. */
export const Route = createFileRoute("/_app/clients/$clientId/ficha")({
  head: () => ({
    meta: [
      { title: "Resumen del cliente | Vibranding" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FichaRoute,
});

function FichaRoute() {
  const { clientId } = Route.useParams();
  return <ClientFichaPage clientId={clientId} />;
}
