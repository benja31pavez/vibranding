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
      {/* El layout del cliente ya aplica ancho máximo y padding. */}
      <MetaConnectCard clientId={clientId} />
      <MetaAdsPanel clientId={clientId} />
    </div>
  );
}
