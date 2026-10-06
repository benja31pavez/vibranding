import { createFileRoute, redirect } from "@tanstack/react-router";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import { PageHeader } from "@/components/app";

/** Facturación = solo lo monetario (pagos). Los contratos viven en Legal. */
export const Route = createFileRoute("/_app/clients/$clientId/facturacion")({
  // `tab` se acepta por links antiguos: "contratos" redirige a Legal.
  validateSearch: (s: Record<string, unknown>): { tab?: "contratos" | "pagos" } => ({
    tab: s.tab === "pagos" ? "pagos" : s.tab === "contratos" ? "contratos" : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    if (search.tab === "contratos") {
      throw redirect({ to: "/clients/$clientId/legal", params });
    }
  },
  head: () => ({
    meta: [
      { title: "Facturación del cliente | Vibranding" },
      { name: "description", content: "Pagos y cobros del cliente." },
      { property: "og:title", content: "Facturación del cliente | Vibranding" },
      { property: "og:description", content: "Pagos y cobros del cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacturacionPage,
});

function FacturacionPage() {
  const { clientId } = Route.useParams();
  return (
    <div className="space-y-4">
      <PageHeader size="compact" title="Facturación" />
      <PaymentsPanel clientId={clientId} />
    </div>
  );
}
