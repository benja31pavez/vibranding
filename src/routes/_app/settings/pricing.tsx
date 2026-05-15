import { createFileRoute } from "@tanstack/react-router";
import { PricingPanel } from "@/components/PricingPanel";

export const Route = createFileRoute("/_app/settings/pricing")({
  component: PricingSettingsPage,
});

function PricingSettingsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
      <PricingPanel />
    </div>
  );
}
