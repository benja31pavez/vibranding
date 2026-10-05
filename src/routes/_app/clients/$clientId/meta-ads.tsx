import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app";
import { MetaAdsPanel } from "@/components/MetaAdsPanel";
import { MetaConnectCard } from "@/components/meta-ads/MetaConnectCard";

export const Route = createFileRoute("/_app/clients/$clientId/meta-ads")({
  head: () => ({ meta: [{ title: "Meta Ads del cliente | Vibranding" }] }),
  component: MetaAdsPage,
});

function MetaAdsPage() {
  const { clientId } = Route.useParams();
  return (
    <div className="space-y-4">
      {/* El layout del cliente ya aplica ancho máximo y padding. */}
      <PageHeader size="compact" title="Meta Ads" />
      <MetaConnectCard clientId={clientId} />
      <MetaAdsPanel clientId={clientId} />
    </div>
  );
}
