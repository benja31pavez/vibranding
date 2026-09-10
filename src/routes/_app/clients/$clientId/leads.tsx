import { createFileRoute } from "@tanstack/react-router";
import { LeadsPage } from "@/components/pages/LeadsPage";

export const Route = createFileRoute("/_app/clients/$clientId/leads")({
  head: () => ({
    meta: [
      { title: "Leads del cliente | Vibranding" },
      {
        name: "description",
        content:
          "Todos los leads del cliente: formularios, sitio web, landing pages, multienlace, WhatsApp e Instagram.",
      },
      { property: "og:title", content: "Leads del cliente | Vibranding" },
      {
        property: "og:description",
        content:
          "Todos los leads del cliente: formularios, sitio web, landing pages, multienlace, WhatsApp e Instagram.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadsRoute,
});

function LeadsRoute() {
  const { clientId } = Route.useParams();
  return <LeadsPage clientId={clientId} />;
}
