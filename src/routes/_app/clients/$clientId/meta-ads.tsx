import { createFileRoute, redirect } from "@tanstack/react-router";
import { isMetaAdsTab, type MetaAdsTab } from "@/components/meta-ads/MetaAdsSectionPage";

interface MetaAdsSearch {
  /** Compatibilidad con enlaces antiguos: subpestaña de Meta Ads. */
  tab?: MetaAdsTab;
  /** Avisos que deja el callback de OAuth de Meta en la URL. */
  meta?: string;
  meta_error?: string;
}

/**
 * Ruta antigua: Meta Ads ahora es una subpestaña dentro de Anuncios (`/anuncios?tab=meta`).
 * Se preservan los enlaces viejos (incluidos los callbacks de OAuth) redirigiendo al nuevo
 * destino, con la subpestaña interna trasladada al search param `metasub`.
 */
export const Route = createFileRoute("/_app/clients/$clientId/meta-ads")({
  validateSearch: (s: Record<string, unknown>): MetaAdsSearch => ({
    tab: isMetaAdsTab(s.tab) ? s.tab : undefined,
    meta: typeof s.meta === "string" ? s.meta : undefined,
    meta_error: typeof s.meta_error === "string" ? s.meta_error : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/clients/$clientId/anuncios",
      params,
      search: {
        tab: "meta",
        metasub: search.tab,
        meta: search.meta,
        meta_error: search.meta_error,
      },
    });
  },
});
