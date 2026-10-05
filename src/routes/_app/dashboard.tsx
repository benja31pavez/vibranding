import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/app";
import {
  ApprovalsToday,
  CampaignAlerts,
  KpiStrip,
  OperationsPanels,
  PipelineFunnel,
  ReviewActivity,
  UpcomingPayments,
  chileToday,
} from "@/components/dashboard";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

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
 * "Hoy": lo que Benjamín necesita revisar al abrir la plataforma.
 * Cada bloque carga y falla por separado (TanStack Query por bloque).
 */
function Dashboard() {
  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Hoy" description={`${todayLabel()} · cobros, aprobaciones y alertas del día.`} />

      <KpiStrip />

      <ReviewActivity />

      <section className="grid gap-4 lg:grid-cols-2">
        <ApprovalsToday />
        <CampaignAlerts />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UpcomingPayments />
        </div>
        <PipelineFunnel />
      </section>

      <OperationsPanels />
    </PageContainer>
  );
}
