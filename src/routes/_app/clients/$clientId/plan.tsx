import { createFileRoute } from "@tanstack/react-router";
import { PlanPage } from "@/components/plan/PlanPage";
import { isStageKey, type StageKey } from "@/lib/delivery/planStages";

/** Pestañas del diseño anterior: se aceptan para que los enlaces viejos sigan funcionando. */
type TabKey = "etapas" | "objetivos" | "tareas";

interface PlanSearch {
  tab?: TabKey;
  /** Etapa seleccionada (filtra el tablero de tareas). */
  etapa?: StageKey;
}

export const Route = createFileRoute("/_app/clients/$clientId/plan")({
  validateSearch: (s: Record<string, unknown>): PlanSearch => ({
    tab:
      s.tab === "objetivos" || s.tab === "tareas" || s.tab === "etapas"
        ? (s.tab as TabKey)
        : undefined,
    etapa: isStageKey(s.etapa) ? s.etapa : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Plan del cliente | Vibranding" },
      {
        name: "description",
        content: "Etapas del plan contratado, objetivos y tareas del cliente.",
      },
      { property: "og:title", content: "Plan del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Etapas del plan contratado, objetivos y tareas del cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanRoute,
});

function PlanRoute() {
  const { clientId } = Route.useParams();
  const { etapa } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PlanPage
      clientId={clientId}
      stage={etapa ?? null}
      onStageChange={(next) =>
        navigate({ search: { etapa: next ?? undefined }, replace: true, resetScroll: false })
      }
    />
  );
}
