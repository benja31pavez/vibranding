import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — kept alive so old links never 404. */
export const Route = createFileRoute("/_app/clients/$clientId/content")({
  head: () => ({ meta: [{ title: "Contenido del cliente | Vibranding" }] }),
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/instagram",
      params,
      search: { tab: "calendario" } as any,
    });
  },
});
