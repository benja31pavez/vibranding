import type { ReactNode } from "react";
import {
  Building2,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileSignature,
  FileText,
  HeartPulse,
  Link2,
  Send,
  Star,
  Users,
} from "lucide-react";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { ErrorState, FitPage, ListSkeleton, Money, Panel, getStatus } from "@/components/app";
import {
  CLIENT_ACCESS_INFO,
  ClientAccessCard,
  useClientAccess,
} from "@/components/clients/ClientAccessCard";
import { ClientHealthCard, HealthBadge, useClientHealth } from "@/components/clients/health";
import {
  FOLLOWUPS_INFO,
  FollowupsPanel,
  useFollowupActions,
} from "@/components/followups/FollowupsPanel";
import { ProposalsPanel } from "@/components/proposals/ProposalsPanel";
import { useRecipientProposals } from "@/components/proposals/proposalQueries";
import { useClientReports } from "@/components/reports/reportQueries";
import { RequestReviewPanel } from "@/components/reviews/RequestReviewPanel";
import { periodLabel } from "@/lib/billing/dates";
import { findPlan } from "@/lib/pricing/plans";
import { BillingCard } from "./BillingCard";
import { BusinessDescription } from "./BusinessDescriptionPanel";
import { ClientHeader } from "./ClientHeader";
import { ContractPanel, useLatestContract } from "./ContractPanel";
import { FichaSection, FichaSheetSection } from "./FichaSection";
import {
  CLIENT_STATUS_META,
  formatDate,
  isClientStatus,
  useFichaHealth,
  useFichaOverview,
  useUserKey,
  type FichaOverview,
} from "./fichaQueries";
import { PendingApprovalPanel, UpcomingContentPanel } from "./MainPanels";
import { MonthPlanInfo, MonthPlanPanel } from "./MonthPlanPanel";
import { OnboardingIntakePanel, useClientIntake } from "./OnboardingIntakePanel";
import { OnboardingLinkPanel, currentOnboardingLink } from "./OnboardingLinkPanel";
import { ReportsPanel } from "./ReportsPanel";
import { useFichaSections } from "./sectionState";
import { HEALTH_INFO, StatusStrip } from "./StatusStrip";

const REVIEWS_INFO =
  "Las reseñas en Google y los testimonios de clientes ayudan a cerrar nuevos clientes.";
const REPORTS_INFO = "Se generan solos el día 1 de cada mes con los resultados del mes anterior.";
const ONBOARDING_INFO = "Datos que el cliente completa en su link de onboarding.";
const ONBOARDING_LINK_INFO =
  "Compártelo con el cliente para que complete sus datos, redes y archivos. Sirve para un solo envío.";
const ABOUT_PREVIEW_CHARS = 60;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Columna de la grilla: en escritorio no crece; si algo no cabe, hace scroll dentro. */
function Column({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div aria-label={label} className="flex min-w-0 flex-col gap-2 md:min-h-0 md:overflow-y-auto">
      {children}
    </div>
  );
}

/**
 * Ficha del cliente en una pantalla (desde `md`, sin scroll de página):
 * encabezado compacto, franja de estado y tres columnas de secciones plegables.
 * Lo esencial queda abierto; lo secundario, plegado con un resumen, y lo que no
 * cabe en una columna (formularios, datos largos) se abre en un panel lateral.
 */
export function FichaPage({ clientId }: { clientId: string }) {
  const { client, ig, reloadClient } = useActiveClient();
  const userKey = useUserKey();
  const overview = useFichaOverview(clientId);
  const health = useFichaHealth(clientId);
  const sections = useFichaSections(userKey);
  const canEdit = Boolean(overview.data?.canEdit);
  const clientName = client?.name ?? "";

  const clientHealth = useClientHealth(clientId);
  const followups = useFollowupActions({ scope: { clientId } });
  const proposals = useRecipientProposals({ kind: "client", id: clientId });
  const reports = useClientReports(userKey, clientId);
  const contract = useLatestContract(clientId);
  const access = useClientAccess(clientId);
  const intake = useClientIntake(clientId, canEdit);

  const approvals = health.data?.approvals.length;
  const upcomingCount = ig.posts.filter(
    (p) =>
      !(p as { archived_at?: string | null }).archived_at &&
      p.scheduled_at &&
      !p.published_at &&
      new Date(p.scheduled_at).getTime() >= Date.now(),
  ).length;
  const latestReport = reports.data?.[0];
  const about = client?.business_description?.trim() ?? "";
  const scored = clientHealth.isPending || Boolean(clientHealth.health) || clientHealth.isError;

  return (
    <FitPage
      header={
        <ClientHeader clientId={clientId} overview={overview.data} loading={overview.isLoading} />
      }
      contentClassName="flex flex-col gap-3"
    >
      <div className="shrink-0">
        <StatusStrip
          clientId={clientId}
          clientName={clientName}
          health={health.data}
          loading={health.isLoading}
          error={health.error}
          onRetry={() => void health.refetch()}
          planKey={overview.data?.billing?.plan_key ?? null}
          canEdit={canEdit}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:min-h-0 md:flex-1 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] xl:grid-cols-3">
        <Column label="Pendientes">
          <FichaSection
            title="Pendiente de aprobación"
            icon={ClipboardCheck}
            summary={approvals === undefined ? undefined : `${approvals}`}
            open={sections.isOpen("approvals")}
            onOpenChange={sections.toggle("approvals")}
            grow={Boolean(approvals)}
          >
            <PendingApprovalPanel
              clientId={clientId}
              health={health.data}
              loading={health.isLoading}
              error={health.error}
              onRetry={() => void health.refetch()}
            />
          </FichaSection>
          <FichaSection
            title="Próximo contenido"
            icon={CalendarClock}
            summary={plural(upcomingCount, "programado", "programados")}
            open={sections.isOpen("upcoming")}
            onOpenChange={sections.toggle("upcoming")}
            grow={upcomingCount > 0}
          >
            <UpcomingContentPanel clientId={clientId} />
          </FichaSection>
        </Column>

        {/* Bajo xl, las columnas 2 y 3 comparten una celda (con scroll interno si hace falta). */}
        <div className="flex min-w-0 flex-col gap-2 md:min-h-0 md:overflow-y-auto xl:contents">
          <Column label="Cliente">
            {scored && (
              <FichaSection
                title="Salud del cliente"
                icon={HeartPulse}
                info={HEALTH_INFO}
                summary={
                  <HealthBadge health={clientHealth.health} loading={clientHealth.isPending} />
                }
                open={sections.isOpen("health")}
                onOpenChange={sections.toggle("health")}
                tone={clientHealth.health?.level === "en_riesgo" ? "warning" : "default"}
              >
                <ClientHealthCard clientId={clientId} />
              </FichaSection>
            )}
            {followups.visible.length > 0 && (
              <FichaSheetSection
                title="Seguimientos sugeridos"
                icon={Send}
                info={FOLLOWUPS_INFO}
                summary={`${followups.visible.length}`}
                wide
              >
                <FollowupsPanel scope={{ clientId }} />
              </FichaSheetSection>
            )}
            <FichaSection
              title="Propuestas"
              icon={FileText}
              summary={proposals.data ? `${proposals.data.length}` : undefined}
              open={sections.isOpen("proposals")}
              onOpenChange={sections.toggle("proposals")}
              grow={Boolean(proposals.data?.length)}
            >
              <ProposalsPanel clientId={clientId} canEdit={canEdit} />
            </FichaSection>
            <FichaSection
              title="Reportes"
              icon={FileBarChart}
              info={REPORTS_INFO}
              summary={
                reports.data
                  ? latestReport
                    ? `último: ${periodLabel(latestReport.period)}`
                    : "sin reportes"
                  : undefined
              }
              open={sections.isOpen("reports")}
              onOpenChange={sections.toggle("reports")}
              grow={Boolean(reports.data?.length)}
            >
              <ReportsPanel clientId={clientId} clientName={clientName} canEdit={canEdit} />
            </FichaSection>
            {overview.data?.canEdit && (
              <FichaSection
                title="Plan del mes"
                icon={CalendarRange}
                info={<MonthPlanInfo clientId={clientId} />}
                summary={findPlan(overview.data.billing?.plan_key)?.label ?? "sin plan"}
                open={sections.isOpen("monthPlan")}
                onOpenChange={sections.toggle("monthPlan")}
              >
                <MonthPlanPanel
                  clientId={clientId}
                  planKey={overview.data.billing?.plan_key ?? null}
                  canEdit={overview.data.canEdit}
                />
              </FichaSection>
            )}
            <FichaSection
              title="Sobre la empresa"
              icon={Building2}
              summary={
                about
                  ? about.length > ABOUT_PREVIEW_CHARS
                    ? `${about.slice(0, ABOUT_PREVIEW_CHARS)}…`
                    : about
                  : "sin descripción"
              }
              open={sections.isOpen("about")}
              onOpenChange={sections.toggle("about")}
            >
              <BusinessDescription
                clientId={clientId}
                value={client?.business_description ?? ""}
                onSaved={reloadClient}
              />
            </FichaSection>
          </Column>

          <Column label="Facturación, contrato y accesos">
            <BillingSection overview={overview} clientId={clientId} />
            {overview.data && (
              <FichaSheetSection
                title="Onboarding"
                icon={ClipboardList}
                info={ONBOARDING_INFO}
                summary={
                  !canEdit
                    ? "solo editores"
                    : intake.data
                      ? `recibido el ${formatDate(intake.data.submitted_at)}`
                      : intake.data === null
                        ? "pendiente"
                        : undefined
                }
                wide
              >
                <OnboardingIntakePanel clientId={clientId} canEdit={overview.data.canEdit} />
              </FichaSheetSection>
            )}
            {overview.data && (
              <FichaSection
                title="Link de onboarding"
                icon={Link2}
                info={ONBOARDING_LINK_INFO}
                summary={onboardingLinkSummary(overview.data)}
                open={sections.isOpen("onboardingLink")}
                onOpenChange={sections.toggle("onboardingLink")}
              >
                <OnboardingLinkPanel clientId={clientId} overview={overview.data} />
              </FichaSection>
            )}
            <FichaSection
              title="Contrato"
              icon={FileSignature}
              summary={
                contract.data === undefined
                  ? undefined
                  : contract.data
                    ? getStatus(contract.data.status).label
                    : "sin contrato"
              }
              open={sections.isOpen("contract")}
              onOpenChange={sections.toggle("contract")}
            >
              <ContractPanel clientId={clientId} />
            </FichaSection>
            <FichaSheetSection
              title="Acceso del cliente"
              icon={Users}
              info={CLIENT_ACCESS_INFO}
              summary={access.data ? plural(access.data.length, "persona", "personas") : undefined}
            >
              <ClientAccessCard clientId={clientId} />
            </FichaSheetSection>
            <FichaSection
              title="Reseñas y testimonios"
              icon={Star}
              info={REVIEWS_INFO}
              open={sections.isOpen("reviews")}
              onOpenChange={sections.toggle("reviews")}
            >
              <RequestReviewPanel clientId={clientId} clientName={clientName} />
            </FichaSection>
          </Column>
        </div>
      </div>
    </FitPage>
  );
}

function onboardingLinkSummary(overview: FichaOverview): string {
  const link = currentOnboardingLink(overview);
  return link ? `vence el ${formatDate(link.expiresAt)}` : "sin link vigente";
}

/** Plan y facturación: resumen en el encabezado y el formulario en un panel lateral. */
function BillingSection({
  clientId,
  overview,
}: {
  clientId: string;
  overview: ReturnType<typeof useFichaOverview>;
}) {
  if (overview.isLoading) {
    return (
      <Panel title="Plan y facturación">
        <ListSkeleton rows={1} label="Cargando facturación" />
      </Panel>
    );
  }
  if (overview.error) {
    return (
      <ErrorState
        message={overview.error.message}
        onRetry={() => void overview.refetch()}
        retrying={overview.isFetching}
      />
    );
  }
  if (!overview.data) return null;
  const data = overview.data;
  const plan = findPlan(data.billing?.plan_key);
  const status = isClientStatus(data.status) ? CLIENT_STATUS_META[data.status].label : data.status;
  return (
    <FichaSheetSection
      title="Plan y facturación"
      icon={CreditCard}
      summary={
        <>
          {plan?.label ?? "Sin plan"} · <Money amount={data.billing?.mrr ?? 0} />
          {data.billing?.billing_day ? ` · día ${data.billing.billing_day}` : ""} · {status}
        </>
      }
    >
      <BillingCard clientId={clientId} overview={data} />
    </FichaSheetSection>
  );
}
