import { createFileRoute } from "@tanstack/react-router";
import {
  GoogleAdsSectionPage,
  isGoogleAdsTab,
  type GoogleAdsTab,
} from "@/components/google-ads/GoogleAdsSectionPage";

interface GoogleAdsSearch {
  /** Subsección: resumen (por defecto), campanas, palabras-clave o anuncios. */
  tab?: GoogleAdsTab;
  /** Avisos que deja el callback de OAuth de Google en la URL. */
  gads?: string;
  gads_error?: string;
}

export const Route = createFileRoute("/_app/clients/$clientId/google-ads")({
  validateSearch: (s: Record<string, unknown>): GoogleAdsSearch => ({
    tab: isGoogleAdsTab(s.tab) ? s.tab : undefined,
    gads: typeof s.gads === "string" ? s.gads : undefined,
    gads_error: typeof s.gads_error === "string" ? s.gads_error : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Google Ads del cliente | Vibranding" },
      {
        name: "description",
        content: "Resumen, campañas, palabras clave y anuncios de Google Ads del cliente.",
      },
    ],
  }),
  component: GoogleAdsRoute,
});

function GoogleAdsRoute() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <GoogleAdsSectionPage
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
