import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — kept alive so old links never 404. */
export const Route = createFileRoute("/_app/clients/$clientId/deliverables")({
  head: () => ({ meta: [{ title: "Entregables del cliente | Vibranding" }] }),
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/plan",
      params,
      search: { tab: "etapas" } as any,
    });
  },
});
