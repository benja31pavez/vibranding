import { createFileRoute } from "@tanstack/react-router";
import { PaymentsPanel } from "@/components/PaymentsPanel";

export const Route = createFileRoute("/_app/clients/$clientId/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const { clientId } = Route.useParams();
  return <PaymentsPanel clientId={clientId} />;
}
