import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app";
import { ContractsPage } from "@/components/pages/ContractsPage";

export const Route = createFileRoute("/_app/clients/$clientId/legal")({
  head: () => ({
    meta: [
      { title: "Legal del cliente | Vibranding" },
      { name: "description", content: "Contratos del cliente." },
      { property: "og:title", content: "Legal del cliente | Vibranding" },
      { property: "og:description", content: "Contratos del cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LegalPage,
});

function LegalPage() {
  const { clientId } = Route.useParams();
  return (
    <div className="space-y-4">
      <PageHeader size="compact" title="Legal" />
      <ContractsPage clientId={clientId} />
    </div>
  );
}
