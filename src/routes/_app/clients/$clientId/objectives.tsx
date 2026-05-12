import { createFileRoute } from "@tanstack/react-router";
import { TaskList } from "@/components/TaskList";

export const Route = createFileRoute("/_app/clients/$clientId/objectives")({
  component: ObjectivesPage,
});

function ObjectivesPage() {
  const { clientId } = Route.useParams();
  return <TaskList clientId={clientId} table="objectives" title="Objetivos" emptyHint="Aún no hay objetivos." />;
}
