import { FitPage, PageHeader } from "@/components/app";
import { AutomationsStatusBadge } from "@/components/automations/automations-status";
import { FollowupsToday } from "./followups-today";
import { KpiStrip } from "./kpi-strip";
import { UpcomingTabs } from "./upcoming-tabs";
import { chileToday } from "./queries";

function todayLabel(): string {
  const label = new Date(`${chileToday()}T12:00:00Z`).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Columnas de Inicio. lg+: 3 columnas a lo alto de la pantalla. md–lg: "Indicadores"
 * en una franja arriba y debajo "Para hacer hoy" | "Próximos días".
 * Móvil: apiladas con scroll normal (orden del DOM).
 */
const GRID =
  "grid gap-4 md:grid-cols-2 md:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(16.5rem,0.9fr)_minmax(0,1.1fr)] lg:grid-rows-[minmax(0,1fr)]";
const COL = "flex min-w-0 flex-col md:min-h-0";

/**
 * "Hoy": lo que Benjamín necesita revisar al abrir la plataforma, en una sola
 * pantalla en escritorio: 1) lo que requiere acción hoy, 2) indicadores, 3) lo que viene.
 * Cada bloque carga y falla por separado (TanStack Query por bloque).
 */
export function DashboardHoy() {
  return (
    <FitPage
      header={
        <PageHeader
          size="compact"
          title="Hoy"
          description={`${todayLabel()} · seguimientos, cobros, aprobaciones y alertas del día.`}
          actions={<AutomationsStatusBadge />}
        />
      }
      contentClassName={GRID}
    >
      <div className={`${COL} md:col-start-1 md:row-start-2 lg:row-start-1`}>
        <FollowupsToday />
      </div>
      <div className={`${COL} md:col-span-2 md:row-start-1 lg:col-span-1 lg:col-start-2`}>
        <KpiStrip />
      </div>
      <div className={`${COL} md:col-start-2 md:row-start-2 lg:col-start-3 lg:row-start-1`}>
        <UpcomingTabs />
      </div>
    </FitPage>
  );
}
