import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — kept alive so old links never 404. */
export const Route = createFileRoute("/_app/clients/$clientId/contracts")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/facturacion",
      params,
      search: { tab: "contratos" } as any,
    });
  },
});
