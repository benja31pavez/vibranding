import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PricingPanel } from "@/components/PricingPanel";

export const Route = createFileRoute("/_app/settings/pricing")({
  component: PricingSettingsPage,
});

function PricingSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 md:px-10 py-10">
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="w-4 h-4" /> Clientes
      </Link>
      <PricingPanel />
    </div>
  );
}
