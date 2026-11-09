import { createFileRoute } from "@tanstack/react-router";
import {
  MetaAdsSectionPage,
  isMetaAdsTab,
  type MetaAdsTab,
} from "@/components/meta-ads/MetaAdsSectionPage";

interface MetaAdsSearch {
  /** Subsección: resumen (por defecto), campanas, anuncios o configuracion. */
  tab?: MetaAdsTab;
  /** Avisos que deja el callback de OAuth de Meta en la URL. */
  meta?: string;
  meta_error?: string;
}

export const Route = createFileRoute("/_app/clients/$clientId/meta-ads")({
  validateSearch: (s: Record<string, unknown>): MetaAdsSearch => ({
    tab: isMetaAdsTab(s.tab) ? s.tab : undefined,
    meta: typeof s.meta === "string" ? s.meta : undefined,
    meta_error: typeof s.meta_error === "string" ? s.meta_error : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Meta Ads del cliente | Vibranding" },
      {
        name: "description",
        content: "Resumen, campañas, anuncios y configuración de Meta Ads del cliente.",
      },
    ],
  }),
  component: MetaAdsRoute,
});

function MetaAdsRoute() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <MetaAdsSectionPage
      clientId={clientId}
      tab={tab ?? "resumen"}
      onTabChange={(next) =>
        navigate({
          // Al cambiar de pestaña se limpian los avisos del callback de OAuth.
          search: () => ({ tab: next === "resumen" ? undefined : next }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
