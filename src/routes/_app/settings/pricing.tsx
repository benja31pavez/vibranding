import { createFileRoute } from "@tanstack/react-router";
import { PricingPanel } from "@/components/PricingPanel";
import { PageContainer } from "@/components/app";

export const Route = createFileRoute("/_app/settings/pricing")({
  component: PricingSettingsPage,
});

function PricingSettingsPage() {
  return (
    <PageContainer>
      <PricingPanel />
    </PageContainer>
  );
}
