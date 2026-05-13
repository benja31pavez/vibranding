import { createFileRoute } from "@tanstack/react-router";
import { ObjectivesList } from "@/components/ObjectivesList";

export const Route = createFileRoute("/_app/clients/$clientId/objectives")({
  component: ObjectivesPage,
});

function ObjectivesPage() {
  const { clientId } = Route.useParams();
  return <ObjectivesList clientId={clientId} />;
}
