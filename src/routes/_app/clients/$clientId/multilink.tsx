import { createFileRoute, redirect } from "@tanstack/react-router";

/** Ruta antigua: se mantiene para que los enlaces viejos no den 404. */
export const Route = createFileRoute("/_app/clients/$clientId/multilink")({
  head: () => ({ meta: [{ title: "Multienlace del cliente | Vibranding" }] }),
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/sitio",
      params,
      search: { tab: "secciones", pagina: "multienlace" },
    });
  },
});
