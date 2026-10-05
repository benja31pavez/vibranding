import { createFileRoute } from "@tanstack/react-router";
import { GoogleAdsConnectCard } from "@/components/google-ads/GoogleAdsConnectCard";
import { GoogleAdsCampaignsTable } from "@/components/google-ads/GoogleAdsCampaignsTable";

export const Route = createFileRoute("/_app/clients/$clientId/google-ads")({
  component: GoogleAdsPage,
});

function GoogleAdsPage() {
  const { clientId } = Route.useParams();
  return (
    <div className="space-y-4">
      {/* El layout del cliente ya aplica ancho máximo y padding. */}
      <GoogleAdsConnectCard clientId={clientId} />
      <GoogleAdsCampaignsTable clientId={clientId} />
    </div>
  );
}
