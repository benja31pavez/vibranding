import { createFileRoute } from "@tanstack/react-router";
import { isProyectosTab, ProyectosPage, type ProyectosTab } from "@/components/plan/ProyectosPage";
import { isStageKey, type StageKey } from "@/lib/delivery/planStages";

interface PlanSearch {
  /** Subsección de Proyectos: resumen (por defecto), notas, tareas u objetivos. */
  tab?: ProyectosTab;
  /** Etapa seleccionada (filtra el tablero de tareas del resumen). */
  etapa?: StageKey;
}

/** Pestañas del diseño anterior: los enlaces viejos siguen funcionando. */
const LEGACY_TABS: Record<string, ProyectosTab> = { etapas: "resumen" };

export const Route = createFileRoute("/_app/clients/$clientId/plan")({
  validateSearch: (s: Record<string, unknown>): PlanSearch => ({
    tab: isProyectosTab(s.tab)
      ? s.tab
      : typeof s.tab === "string" && LEGACY_TABS[s.tab]
        ? LEGACY_TABS[s.tab]
        : undefined,
    etapa: isStageKey(s.etapa) ? s.etapa : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Proyectos del cliente | Vibranding" },
      {
        name: "description",
        content: "Etapas del plan contratado, notas, tareas y objetivos del cliente.",
      },
      { property: "og:title", content: "Proyectos del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Etapas del plan contratado, notas, tareas y objetivos del cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanRoute,
});

function PlanRoute() {
  const { clientId } = Route.useParams();
  const { etapa, tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ProyectosPage
      clientId={clientId}
      tab={tab ?? "resumen"}
      onTabChange={(next) =>
        navigate({
          search: (prev) => ({ ...prev, tab: next === "resumen" ? undefined : next }),
          replace: true,
          resetScroll: false,
        })
      }
      stage={etapa ?? null}
      onStageChange={(next) =>
        navigate({
          search: (prev) => ({ ...prev, etapa: next ?? undefined }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
