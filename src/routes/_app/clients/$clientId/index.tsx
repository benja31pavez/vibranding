import { createFileRoute } from "@tanstack/react-router";
import { FichaPage, isPanelTab, type PanelTab } from "@/components/clients/ficha/FichaPage";

interface PanelSearch {
  /** Subsección del Panel: resumen (por defecto), kit, bitacora o configuracion. */
  tab?: PanelTab;
}

export const Route = createFileRoute("/_app/clients/$clientId/")({
  validateSearch: (s: Record<string, unknown>): PanelSearch => ({
    tab: isPanelTab(s.tab) ? s.tab : undefined,
  }),
  head: () => ({ meta: [{ title: "Panel del cliente | Vibranding" }] }),
  component: PanelRoute,
});

function PanelRoute() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <FichaPage
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
