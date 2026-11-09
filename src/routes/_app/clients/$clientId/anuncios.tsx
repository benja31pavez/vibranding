import { createFileRoute } from "@tanstack/react-router";
import {
  AnunciosPage,
  isAnunciosTab,
  isGoogleAdsTab,
  isMetaAdsTab,
  type AnunciosTab,
} from "@/components/anuncios/AnunciosPage";
import type { MetaAdsTab } from "@/components/meta-ads/MetaAdsSectionPage";
import type { GoogleAdsTab } from "@/components/google-ads/GoogleAdsSectionPage";

interface AnunciosSearch {
  /** Subsección de Anuncios: resumen (por defecto), meta, google o configuracion. */
  tab?: AnunciosTab;
  /** Subpestaña dentro de Meta Ads (resumen/campanas/anuncios/configuracion). */
  metasub?: MetaAdsTab;
  /** Subpestaña dentro de Google Ads (resumen/campanas/palabras-clave/anuncios). */
  gadssub?: GoogleAdsTab;
  /** Avisos que dejan los callbacks de OAuth de Meta y Google en la URL. */
  meta?: string;
  meta_error?: string;
  gads?: string;
  gads_error?: string;
}

export const Route = createFileRoute("/_app/clients/$clientId/anuncios")({
  validateSearch: (s: Record<string, unknown>): AnunciosSearch => ({
    tab: isAnunciosTab(s.tab) ? s.tab : undefined,
    metasub: isMetaAdsTab(s.metasub) ? s.metasub : undefined,
    gadssub: isGoogleAdsTab(s.gadssub) ? s.gadssub : undefined,
    meta: typeof s.meta === "string" ? s.meta : undefined,
    meta_error: typeof s.meta_error === "string" ? s.meta_error : undefined,
    gads: typeof s.gads === "string" ? s.gads : undefined,
    gads_error: typeof s.gads_error === "string" ? s.gads_error : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Anuncios del cliente | Vibranding" },
      {
        name: "description",
        content: "Meta Ads, Google Ads y configuración común en una sola pantalla.",
      },
      { property: "og:title", content: "Anuncios del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Meta Ads, Google Ads y configuración común en una sola pantalla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnunciosRoute,
});

function AnunciosRoute() {
  const { clientId } = Route.useParams();
  const { tab, metasub, gadssub } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AnunciosPage
      clientId={clientId}
      tab={tab ?? "resumen"}
      onTabChange={(next) =>
        navigate({
          search: (prev) => ({
            ...prev,
            tab: next === "resumen" ? undefined : next,
          }),
          replace: true,
          resetScroll: false,
        })
      }
      metaSub={metasub ?? "resumen"}
      onMetaSubChange={(next) =>
        navigate({
          search: (prev) => ({
            ...prev,
            metasub: next === "resumen" ? undefined : next,
          }),
          replace: true,
          resetScroll: false,
        })
      }
      googleSub={gadssub ?? "resumen"}
      onGoogleSubChange={(next) =>
        navigate({
          search: (prev) => ({
            ...prev,
            gadssub: next === "resumen" ? undefined : next,
          }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
