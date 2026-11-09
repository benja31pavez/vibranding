import { createFileRoute } from "@tanstack/react-router";
import { isLeadsTab, LeadsSectionPage, type LeadsTab } from "@/components/leads/LeadsSectionPage";

interface LeadsSearch {
  /** Subsección de Leads: resumen (por defecto), listado, embudo u origenes. */
  tab?: LeadsTab;
}

export const Route = createFileRoute("/_app/clients/$clientId/leads")({
  validateSearch: (s: Record<string, unknown>): LeadsSearch => ({
    tab: isLeadsTab(s.tab) ? s.tab : undefined,
  }),
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
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <LeadsSectionPage
      clientId={clientId}
      tab={tab ?? "resumen"}
      onTabChange={(next) =>
        navigate({
          search: () => ({ tab: next === "resumen" ? undefined : next }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
