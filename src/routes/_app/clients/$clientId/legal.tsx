import { createFileRoute } from "@tanstack/react-router";
import { isLegalTab, LegalPage, type LegalTab } from "@/components/contracts/LegalPage";

interface LegalSearch {
  /** Subsección de Legal: resumen (por defecto), documentos, firmas o plantillas. */
  tab?: LegalTab;
}

export const Route = createFileRoute("/_app/clients/$clientId/legal")({
  validateSearch: (s: Record<string, unknown>): LegalSearch => ({
    tab: isLegalTab(s.tab) ? s.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Legal del cliente | Vibranding" },
      { name: "description", content: "Contratos, firmas y plantillas del cliente." },
      { property: "og:title", content: "Legal del cliente | Vibranding" },
      { property: "og:description", content: "Contratos, firmas y plantillas del cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LegalRoute,
});

function LegalRoute() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <LegalPage
      clientId={clientId}
      tab={tab ?? "resumen"}
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
