import { createFileRoute, redirect } from "@tanstack/react-router";
import { StatementPage } from "@/components/billing/statement/StatementPage";

/** Facturación = estado de cuenta: plan, pagos y documentos. Los contratos viven en Legal. */
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
      { name: "description", content: "Estado de cuenta: plan, pagos y boletas del cliente." },
      { property: "og:title", content: "Facturación del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Estado de cuenta: plan, pagos y boletas del cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacturacionPage,
});

function FacturacionPage() {
  const { clientId } = Route.useParams();
  return <StatementPage clientId={clientId} />;
}
