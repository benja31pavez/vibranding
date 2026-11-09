import { createFileRoute, redirect } from "@tanstack/react-router";

interface MetaAdsSearch {
  /** Avisos que deja el callback de OAuth de Meta en la URL. */
  meta?: string;
  meta_error?: string;
}

/**
 * Ruta antigua: Meta Ads ahora es una subpestaña dentro de Anuncios (`/anuncios?tab=meta`).
 * Se preservan los enlaces viejos (incluidos los callbacks de OAuth) redirigiendo al nuevo
 * destino. La pantalla destino ya no tiene subpestañas internas.
 */
export const Route = createFileRoute("/_app/clients/$clientId/meta-ads")({
  validateSearch: (s: Record<string, unknown>): MetaAdsSearch => ({
    meta: typeof s.meta === "string" ? s.meta : undefined,
    meta_error: typeof s.meta_error === "string" ? s.meta_error : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/clients/$clientId/anuncios",
      params,
      search: {
        tab: "meta",
        meta: search.meta,
        meta_error: search.meta_error,
      },
    });
  },
});
