import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — kept alive so old links never 404. */
export const Route = createFileRoute("/_app/clients/$clientId/leads")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/bandeja",
      params,
      search: { tab: "leads" } as any,
    });
  },
});
