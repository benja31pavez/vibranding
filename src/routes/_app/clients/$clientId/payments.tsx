import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — kept alive so old links never 404. */
export const Route = createFileRoute("/_app/clients/$clientId/payments")({
  head: () => ({ meta: [{ title: "Pagos del cliente | Vibranding" }] }),
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/facturacion",
      params,
      search: { tab: "pagos" } as any,
    });
  },
});
