import { createFileRoute, redirect } from "@tanstack/react-router";
import { isGoogleAdsTab, type GoogleAdsTab } from "@/components/google-ads/GoogleAdsSectionPage";

interface GoogleAdsSearch {
  /** Compatibilidad con enlaces antiguos: subpestaña de Google Ads. */
  tab?: GoogleAdsTab;
  /** Avisos que deja el callback de OAuth de Google en la URL. */
  gads?: string;
  gads_error?: string;
}

/**
 * Ruta antigua: Google Ads ahora es una subpestaña dentro de Anuncios (`/anuncios?tab=google`).
 * Se preservan los enlaces viejos (incluidos los callbacks de OAuth) redirigiendo al nuevo
 * destino, con la subpestaña interna trasladada al search param `gadssub`.
 */
export const Route = createFileRoute("/_app/clients/$clientId/google-ads")({
  validateSearch: (s: Record<string, unknown>): GoogleAdsSearch => ({
    tab: isGoogleAdsTab(s.tab) ? s.tab : undefined,
    gads: typeof s.gads === "string" ? s.gads : undefined,
    gads_error: typeof s.gads_error === "string" ? s.gads_error : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/clients/$clientId/anuncios",
      params,
      search: {
        tab: "google",
        gadssub: search.tab,
        gads: search.gads,
        gads_error: search.gads_error,
      },
    });
  },
});
