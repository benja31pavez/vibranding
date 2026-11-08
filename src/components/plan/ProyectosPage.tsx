import { FitPage, PageHeader, SectionTabs, type SectionTab } from "@/components/app";
import { ClientTasksList } from "@/components/ClientTasksList";
import { ObjectivesList } from "@/components/ObjectivesList";
import { useReviewAlerts } from "@/hooks/use-review-alerts";
import type { StageKey } from "@/lib/delivery/planStages";
import { ClientNotesPanel } from "./ClientNotesPanel";
import { PlanPage } from "./PlanPage";

export type ProyectosTab = "resumen" | "notas" | "tareas" | "objetivos";

export const PROYECTOS_TABS: readonly ProyectosTab[] = ["resumen", "notas", "tareas", "objetivos"];

export function isProyectosTab(v: unknown): v is ProyectosTab {
  return typeof v === "string" && (PROYECTOS_TABS as readonly string[]).includes(v);
}

interface ProyectosPageProps {
  clientId: string;
  tab: ProyectosTab;
  onTabChange: (tab: ProyectosTab) => void;
  stage: StageKey | null;
  onStageChange: (stage: StageKey | null) => void;
}

/**
 * "Proyectos" del cliente, con cuatro subsecciones: Resumen (etapas, objetivos y
 * tablero de tareas en una pantalla), Notas, Tareas y Objetivos.
 */
export function ProyectosPage({
  clientId,
  tab,
  onTabChange,
  stage,
  onStageChange,
}: ProyectosPageProps) {
  const { count: reviewCount } = useReviewAlerts(clientId);
  const tabs: readonly SectionTab<ProyectosTab>[] = [
    { key: "resumen", label: "Resumen" },
    { key: "notas", label: "Notas" },
    { key: "tareas", label: "Tareas", badge: reviewCount },
    { key: "objetivos", label: "Objetivos" },
  ];
  const bar = (
    <SectionTabs tabs={tabs} value={tab} onChange={onTabChange} label="Vistas de Proyectos" />
  );

  if (tab === "resumen") {
    return <PlanPage clientId={clientId} stage={stage} onStageChange={onStageChange} tabs={bar} />;
  }

  const description =
    tab === "notas"
      ? "Lo que acordaron y el contexto del cliente"
      : tab === "tareas"
        ? "Todas las tareas del cliente, con responsable y fecha"
        : "Objetivos del plan y su avance";

  return (
    <FitPage
      header={
        <div className="flex flex-col gap-3">
          <PageHeader size="compact" title="Proyectos" description={description} />
          {bar}
        </div>
      }
      contentClassName="flex flex-col gap-3"
      scroll={tab !== "notas"}
    >
      {tab === "notas" && <ClientNotesPanel clientId={clientId} />}
      {tab === "tareas" && <ClientTasksList clientId={clientId} />}
      {tab === "objetivos" && <ObjectivesList clientId={clientId} />}
    </FitPage>
  );
}
