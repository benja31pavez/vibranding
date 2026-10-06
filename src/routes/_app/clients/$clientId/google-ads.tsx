import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app";
import { GoogleAdsConnectCard } from "@/components/google-ads/GoogleAdsConnectCard";
import {
  useGoogleAdsHasHistory,
  useGoogleAdsOverview,
} from "@/components/google-ads/googleAdsOverviewQueries";
import { GoogleAdsCampaignsTable } from "@/components/google-ads/GoogleAdsCampaignsTable";
import { GoogleAdsBillingPanel } from "@/components/google-ads/GoogleAdsBillingPanel";

export const Route = createFileRoute("/_app/clients/$clientId/google-ads")({
  head: () => ({ meta: [{ title: "Google Ads del cliente | Vibranding" }] }),
  component: GoogleAdsPage,
});

function GoogleAdsPage() {
  const { clientId } = Route.useParams();
  const overview = useGoogleAdsOverview(clientId);
  const history = useGoogleAdsHasHistory(clientId);
  // Campañas y Pago solo se ocultan cuando de verdad no hay nada: overview leído sin conexión
  // y sin métricas guardadas. Si el overview falla, o el token venció, se siguen mostrando.
  const noAccount = overview.isSuccess && !overview.data.connection;
  const noHistory = history.isSuccess && !history.data;
  const showData = !(noAccount && noHistory) && !overview.isLoading;
  return (
    <div className="space-y-4">
      {/* El layout del cliente ya aplica ancho máximo y padding. */}
      <PageHeader size="compact" title="Google Ads" />
      <GoogleAdsConnectCard clientId={clientId} />
      {showData && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <GoogleAdsCampaignsTable clientId={clientId} />
          <GoogleAdsBillingPanel clientId={clientId} />
        </div>
      )}
    </div>
  );
}
