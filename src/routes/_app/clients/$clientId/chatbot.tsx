import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — kept alive so old links never 404. */
export const Route = createFileRoute("/_app/clients/$clientId/chatbot")({
  head: () => ({ meta: [{ title: "Chatbot de WhatsApp | Vibranding" }] }),
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/bandeja",
      params,
      search: { tab: "whatsapp" } as any,
    });
  },
});
