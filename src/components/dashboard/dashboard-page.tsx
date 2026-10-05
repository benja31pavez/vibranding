import type { ReactNode } from "react";
import { PageContainer, PageHeader } from "@/components/app";
import { PostFeedbackPanel } from "@/components/instagram/PostFeedbackPanel";
import { AutomationsSummaryCard } from "@/components/automations/automations-status";
import { ApprovalsToday } from "./approvals-today";
import { CampaignAlerts } from "./campaign-alerts";
import { FollowupsToday } from "./followups-today";
import { KpiStrip } from "./kpi-strip";
import { ScheduledPostsPanel, UpcomingDeliverablesPanel } from "./operations";
import { PipelineFunnel } from "./pipeline-funnel";
import { ReviewActivity } from "./review-activity";
import { UpcomingPayments } from "./upcoming-payments";
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

/** Bloque de la pantalla con un rótulo discreto que ordena la lectura. */
function DashboardSection({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </h2>
      {children}
    </section>
  );
}

/** Columna de tarjetas apiladas (los bloques que devuelven null no dejan huecos). */
function Stack({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-4">{children}</div>;
}

/**
 * "Hoy": lo que Benjamín necesita revisar al abrir la plataforma.
 * Orden: 1) lo que requiere acción hoy, 2) indicadores, 3) lo que viene.
 * Cada bloque carga y falla por separado (TanStack Query por bloque).
 */
export function DashboardHoy() {
  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Hoy"
        description={`${todayLabel()} · seguimientos, cobros, aprobaciones y alertas del día.`}
      />

      <DashboardSection id="hoy-accion" label="Para hacer hoy">
        <FollowupsToday />
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Stack>
            <UpcomingPayments />
            <CampaignAlerts />
          </Stack>
          <Stack>
            <ApprovalsToday />
            <ReviewActivity />
            <PostFeedbackPanel tone="default" />
          </Stack>
        </div>
      </DashboardSection>

      <DashboardSection id="hoy-indicadores" label="Indicadores">
        <KpiStrip />
      </DashboardSection>

      <DashboardSection id="hoy-proximo" label="Próximos días">
        <AutomationsSummaryCard />
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UpcomingDeliverablesPanel />
          <ScheduledPostsPanel />
          <div className="min-w-0 md:col-span-2 xl:col-span-1">
            <PipelineFunnel />
          </div>
        </div>
      </DashboardSection>
    </PageContainer>
  );
}
