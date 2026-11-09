import { createFileRoute, redirect } from "@tanstack/react-router";

/** Ruta antigua: sigue viva para que los enlaces viejos no den 404 (va a Facturación › Cobros). */
export const Route = createFileRoute("/_app/clients/$clientId/payments")({
  head: () => ({ meta: [{ title: "Pagos del cliente | Vibranding" }] }),
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/facturacion",
      params,
      search: { tab: "cobros" },
    });
  },
});
