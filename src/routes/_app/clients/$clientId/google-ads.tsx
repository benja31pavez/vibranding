import { createFileRoute, redirect } from "@tanstack/react-router";

interface GoogleAdsSearch {
  /** Avisos que deja el callback de OAuth de Google en la URL. */
  gads?: string;
  gads_error?: string;
}

/**
 * Ruta antigua: Google Ads ahora es una subpestaña dentro de Anuncios (`/anuncios?tab=google`).
 * Se preservan los enlaces viejos (incluidos los callbacks de OAuth) redirigiendo al nuevo
 * destino. La pantalla destino ya no tiene subpestañas internas.
 */
export const Route = createFileRoute("/_app/clients/$clientId/google-ads")({
  validateSearch: (s: Record<string, unknown>): GoogleAdsSearch => ({
    gads: typeof s.gads === "string" ? s.gads : undefined,
    gads_error: typeof s.gads_error === "string" ? s.gads_error : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/clients/$clientId/anuncios",
      params,
      search: {
        tab: "google",
        gads: search.gads,
        gads_error: search.gads_error,
      },
    });
  },
});
