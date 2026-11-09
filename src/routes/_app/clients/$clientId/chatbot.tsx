import { createFileRoute, redirect } from "@tanstack/react-router";

/** Ruta antigua: el chatbot ahora es una subpestaña de WhatsApp dentro de Canales. */
export const Route = createFileRoute("/_app/clients/$clientId/chatbot")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/canales",
      params,
      search: { tab: "whatsapp", wasub: "chatbot" },
    });
  },
});
