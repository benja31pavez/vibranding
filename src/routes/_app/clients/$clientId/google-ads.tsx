import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app";
import { GoogleAdsConnectCard } from "@/components/google-ads/GoogleAdsConnectCard";
import { useGoogleAdsOverview } from "@/components/google-ads/googleAdsOverviewQueries";
import { GoogleAdsCampaignsTable } from "@/components/google-ads/GoogleAdsCampaignsTable";
import { GoogleAdsBillingPanel } from "@/components/google-ads/GoogleAdsBillingPanel";

export const Route = createFileRoute("/_app/clients/$clientId/google-ads")({
  head: () => ({ meta: [{ title: "Google Ads del cliente | Vibranding" }] }),
  component: GoogleAdsPage,
});

function GoogleAdsPage() {
  const { clientId } = Route.useParams();
  const overview = useGoogleAdsOverview(clientId);
  // Sin cuenta vinculada, la tarjeta de conexión es lo único útil: pago y campañas estarían vacíos.
  const linked = Boolean(overview.data?.configured && overview.data.connection);
  return (
    <div className="space-y-4">
      {/* El layout del cliente ya aplica ancho máximo y padding. */}
      <PageHeader size="compact" title="Google Ads" />
      <GoogleAdsConnectCard clientId={clientId} />
      {linked && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <GoogleAdsCampaignsTable clientId={clientId} />
          <GoogleAdsBillingPanel clientId={clientId} />
        </div>
      )}
    </div>
  );
}
