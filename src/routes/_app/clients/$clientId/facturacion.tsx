import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractsPage } from "@/components/pages/ContractsPage";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import { PageHeader } from "@/components/app";

export const Route = createFileRoute("/_app/clients/$clientId/facturacion")({
  validateSearch: (s: Record<string, unknown>): { tab?: "contratos" | "pagos" } => ({
    tab: s.tab === "pagos" ? "pagos" : s.tab === "contratos" ? "contratos" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Facturación del cliente | Vibranding" },
      { name: "description", content: "Contratos y pagos del cliente en una sola vista." },
      { property: "og:title", content: "Facturación del cliente | Vibranding" },
      { property: "og:description", content: "Contratos y pagos del cliente en una sola vista." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacturacionPage,
});

function FacturacionPage() {
  const { clientId } = Route.useParams();
  const { tab = "contratos" } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturación"
        description="Contratos y pagos del cliente en una sola vista."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as "contratos" | "pagos" } })}
        className="space-y-4"
      >
        <TabsList aria-label="Secciones de facturación">
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
        </TabsList>
        <TabsContent value="contratos">
          <ContractsPage clientId={clientId} />
        </TabsContent>
        <TabsContent value="pagos">
          <PaymentsPanel clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
