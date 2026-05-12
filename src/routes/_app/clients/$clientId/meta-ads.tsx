import { createFileRoute } from "@tanstack/react-router";
import { MetaAdsPanel } from "@/components/MetaAdsPanel";

export const Route = createFileRoute("/_app/clients/$clientId/meta-ads")({
  component: MetaAdsPage,
});

function MetaAdsPage() {
  const { clientId } = Route.useParams();
  return <MetaAdsPanel clientId={clientId} />;
}
