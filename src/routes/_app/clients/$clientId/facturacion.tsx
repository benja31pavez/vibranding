import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  isFacturacionTab,
  StatementPage,
  type FacturacionTab,
} from "@/components/billing/statement/StatementPage";

interface FacturacionSearch {
  /**
   * Subsección: resumen (por defecto), cobros, propuestas o documentos.
   * Valores antiguos que siguen aceptándose en los enlaces: "pagos" (→ cobros) y
   * "contratos" (→ Legal).
   */
  tab?: FacturacionTab | "pagos" | "contratos";
}

/** Pestañas del diseño anterior: los enlaces viejos siguen funcionando. */
const LEGACY_TABS: Record<string, FacturacionTab> = { pagos: "cobros" };

/** Facturación = estado de cuenta: plan, cobros, propuestas y documentos. Los contratos viven en Legal. */
export const Route = createFileRoute("/_app/clients/$clientId/facturacion")({
  validateSearch: (s: Record<string, unknown>): FacturacionSearch => ({
    tab: isFacturacionTab(s.tab)
      ? s.tab
      : s.tab === "contratos"
        ? "contratos"
        : typeof s.tab === "string" && LEGACY_TABS[s.tab]
          ? LEGACY_TABS[s.tab]
          : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    if (search.tab === "contratos") {
      throw redirect({ to: "/clients/$clientId/legal", params, search: { tab: "documentos" } });
    }
  },
  head: () => ({
    meta: [
      { title: "Facturación del cliente | Vibranding" },
      {
        name: "description",
        content: "Estado de cuenta: plan, cobros, propuestas y boletas del cliente.",
      },
      { property: "og:title", content: "Facturación del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Estado de cuenta: plan, cobros, propuestas y boletas del cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacturacionPage,
});

function FacturacionPage() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <StatementPage
      clientId={clientId}
      tab={isFacturacionTab(tab) ? tab : tab === "pagos" ? "cobros" : "resumen"}
      onTabChange={(next) =>
        navigate({
          search: () => ({ tab: next === "resumen" ? undefined : next }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
