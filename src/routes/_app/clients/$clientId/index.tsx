import { createFileRoute } from "@tanstack/react-router";
import { FichaPage } from "@/components/clients/ficha/FichaPage";

export const Route = createFileRoute("/_app/clients/$clientId/")({
  head: () => ({ meta: [{ title: "Gestión del cliente | Vibranding" }] }),
  component: ClientFichaPage,
});

function ClientFichaPage() {
  const { clientId } = Route.useParams();
  return <FichaPage clientId={clientId} />;
}
