import { createFileRoute, redirect } from "@tanstack/react-router";

/** Ruta antigua: sigue viva para que los enlaces viejos no den 404 (va a Legal › Documentos). */
export const Route = createFileRoute("/_app/clients/$clientId/contracts")({
  head: () => ({ meta: [{ title: "Contratos del cliente | Vibranding" }] }),
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/legal",
      params,
      search: { tab: "documentos" },
    });
  },
});
