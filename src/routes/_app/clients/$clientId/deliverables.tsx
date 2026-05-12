import { createFileRoute } from "@tanstack/react-router";
import { TaskList } from "@/components/TaskList";

export const Route = createFileRoute("/_app/clients/$clientId/deliverables")({
  component: DeliverablesPage,
});

function DeliverablesPage() {
  const { clientId } = Route.useParams();
  return <TaskList clientId={clientId} table="deliverables" title="Entregables" emptyHint="Aún no hay entregables." />;
}
