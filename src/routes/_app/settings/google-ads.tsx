import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/app";
import { AgencyGoogleAdsPanel } from "@/components/google-ads/AgencyGoogleAdsPanel";

export const Route = createFileRoute("/_app/settings/google-ads")({
  head: () => ({
    meta: [
      { title: "Google Ads de la agencia | Vibranding" },
      {
        name: "description",
        content:
          "Conecta una vez la cuenta administradora (MCC) de la agencia para vincular a todos tus clientes de Google Ads.",
      },
    ],
  }),
  component: AgencyGoogleAdsPage,
});

function AgencyGoogleAdsPage() {
  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Google Ads de la agencia"
        description="Una sola conexión con la cuenta administradora (MCC) sirve para todos los clientes. Cada cliente paga su pauta con su propia tarjeta en su cuenta de Google Ads."
      />
      <AgencyGoogleAdsPanel />
    </PageContainer>
  );
}
