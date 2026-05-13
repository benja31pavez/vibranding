import { createFileRoute } from "@tanstack/react-router";
import { DeliverablesList } from "@/components/DeliverablesList";

export const Route = createFileRoute("/_app/clients/$clientId/deliverables")({
  component: DeliverablesPage,
});

function DeliverablesPage() {
  const { clientId } = Route.useParams();
  return <DeliverablesList clientId={clientId} />;
}
