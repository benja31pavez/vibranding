import { createFileRoute } from "@tanstack/react-router";
import { MetaAdsPanel } from "@/components/MetaAdsPanel";
import { MetaConnectCard } from "@/components/meta-ads/MetaConnectCard";

export const Route = createFileRoute("/_app/clients/$clientId/meta-ads")({
  component: MetaAdsPage,
});

function MetaAdsPage() {
  const { clientId } = Route.useParams();
  return (
    <div className="space-y-4">
      <div className="p-6 md:p-8 pb-0 max-w-7xl mx-auto">
        <MetaConnectCard clientId={clientId} />
      </div>
      <MetaAdsPanel clientId={clientId} />
    </div>
  );
}
