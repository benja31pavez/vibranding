import { createFileRoute, redirect } from "@tanstack/react-router";

/** Ruta antigua: el chatbot ahora es una subsección de WhatsApp (`/bandeja?tab=chatbot`). */
export const Route = createFileRoute("/_app/clients/$clientId/chatbot")({
  head: () => ({ meta: [{ title: "Chatbot de WhatsApp | Vibranding" }] }),
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/bandeja",
      params,
      search: { tab: "chatbot" },
    });
  },
});
