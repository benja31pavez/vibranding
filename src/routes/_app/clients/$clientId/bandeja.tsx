import { createFileRoute, redirect } from "@tanstack/react-router";
import { ChatbotPage } from "@/components/pages/ChatbotPage";

export const Route = createFileRoute("/_app/clients/$clientId/bandeja")({
  // Legacy links used ?tab=leads — accepted so old URLs never break.
  validateSearch: (s: Record<string, unknown>): { tab?: "whatsapp" | "leads" } => ({
    tab: s.tab === "leads" ? "leads" : s.tab === "whatsapp" ? "whatsapp" : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    if (search.tab === "leads") {
      throw redirect({ to: "/clients/$clientId/leads", params });
    }
  },
  head: () => ({
    meta: [
      { title: "Bandeja de WhatsApp | Vibranding" },
      { name: "description", content: "Conversaciones de WhatsApp del cliente en un solo lugar." },
      { property: "og:title", content: "Bandeja de WhatsApp | Vibranding" },
      {
        property: "og:description",
        content: "Conversaciones de WhatsApp del cliente en un solo lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BandejaPage,
});

function BandejaPage() {
  const { clientId } = Route.useParams();
  return <ChatbotPage clientId={clientId} />;
}
