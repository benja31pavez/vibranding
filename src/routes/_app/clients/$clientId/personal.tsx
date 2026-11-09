import { createFileRoute } from "@tanstack/react-router";
import { isPersonalTab, PersonalPage, type PersonalTab } from "@/components/personal/PersonalPage";

interface PersonalSearch {
  /** Subsección de Personal: resumen (por defecto), equipo, roles o historial. */
  tab?: PersonalTab;
}

export const Route = createFileRoute("/_app/clients/$clientId/personal")({
  validateSearch: (s: Record<string, unknown>): PersonalSearch => ({
    tab: isPersonalTab(s.tab) ? s.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Personal del cliente | Vibranding" },
      {
        name: "description",
        content:
          "Equipo del cliente: estructura pensada para listar personas, roles e historial cuando existan los datos.",
      },
      { property: "og:title", content: "Personal del cliente | Vibranding" },
      {
        property: "og:description",
        content:
          "Equipo del cliente: estructura pensada para listar personas, roles e historial cuando existan los datos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonalRoute,
});

function PersonalRoute() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PersonalPage
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
