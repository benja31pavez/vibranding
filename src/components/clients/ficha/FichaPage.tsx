import { useRef, type ReactNode } from "react";
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
  PanelRightOpen,
  Pencil,
  Send,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { FitPage, getStatus } from "@/components/app";
import {
  CLIENT_ACCESS_INFO,
  ClientAccessCard,
  ClientAccessSummary,
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
import { BillingSummary, billingHeadline } from "./BillingSummary";
import { BusinessDescription } from "./BusinessDescriptionPanel";
import { ClientHeader } from "./ClientHeader";
import { ContractPanel, useLatestContract } from "./ContractPanel";
import { FichaSection, FichaSheetSection } from "./FichaSection";
import {
  formatDate,
  useFichaHealth,
  useFichaOverview,
  useUserKey,
  type FichaOverview,
} from "./fichaQueries";
import { PendingApprovalPanel, UpcomingContentPanel } from "./MainPanels";
import { MonthPlanInfo, MonthPlanPanel } from "./MonthPlanPanel";
import {
  OnboardingIntakePanel,
  OnboardingIntakeSummary,
  useClientIntake,
} from "./OnboardingIntakePanel";
import { OnboardingLinkPanel, currentOnboardingLink } from "./OnboardingLinkPanel";
import { ReportsPanel } from "./ReportsPanel";
import { useFichaSections } from "./sectionState";
import { FIT_COLUMN_ATTR, useFichaAutoFit } from "./useFichaAutoFit";
import { HEALTH_INFO, StatusStrip } from "./StatusStrip";

const REVIEWS_INFO =
  "Las reseñas en Google y los testimonios de clientes ayudan a cerrar nuevos clientes.";
const REPORTS_INFO = "Se generan solos el día 1 de cada mes con los resultados del mes anterior.";
const ONBOARDING_INFO = "Datos que el cliente completa en su link de onboarding.";
const ONBOARDING_LINK_INFO =
  "Compártelo con el cliente para que complete sus datos, redes y archivos. Sirve para un solo envío.";
const ABOUT_PREVIEW_CHARS = 60;
/** Propuestas y reportes que se ven en la ficha; el resto, en "Ver todos". */
const PROPOSALS_INLINE = 3;
const REPORTS_INLINE = 1;
const FIT_COLUMN = { [FIT_COLUMN_ATTR]: "" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Columna de la grilla: en escritorio no crece; si algo no cabe, la ficha pliega secciones. */
function Column({
  label,
  nested = false,
  children,
}: {
  label: string;
  /** Dentro de la celda compartida bajo `xl`: ahí la que limita el alto es la celda. */
  nested?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-label={label}
      {...FIT_COLUMN}
      className={
        nested
          ? "flex min-w-0 flex-col gap-3 xl:min-h-0 xl:overflow-y-auto"
          : "flex min-w-0 flex-col gap-3 md:min-h-0 md:overflow-y-auto"
      }
    >
      {children}
    </div>
  );
}

/**
 * Ficha del cliente en una pantalla (desde `md`, sin scroll de página):
 * encabezado compacto, franja de estado y tres columnas de secciones plegables
 * que muestran su contenido clave. Si una columna no cabe, se pliegan solas las
 * secciones menos urgentes; formularios y detalle completo van en paneles laterales.
 */
export function FichaPage({ clientId }: { clientId: string }) {
  const { client, ig, reloadClient } = useActiveClient();
  const userKey = useUserKey();
  const overview = useFichaOverview(clientId);
  const health = useFichaHealth(clientId);
  const sections = useFichaSections(userKey);
  const gridRef = useRef<HTMLDivElement>(null);
  useFichaAutoFit(gridRef, sections);
  const canEdit = Boolean(overview.data?.canEdit);
  const clientName = client?.name ?? "";

  const clientHealth = useClientHealth(clientId);
  const followups = useFollowupActions({ scope: { clientId } });
  const proposals = useRecipientProposals({ kind: "client", id: clientId });
  const reports = useClientReports(userKey, clientId);
  const contract = useLatestContract(clientId);
  const access = useClientAccess(clientId);
  const intake = useClientIntake(clientId, canEdit);

  const section = (id: Parameters<typeof sections.isOpen>[0]) => ({
    sectionId: id,
    open: sections.isOpen(id),
    onOpenChange: sections.toggle(id),
  });

  const approvals = health.data?.approvals.length;
  const upcomingCount = ig.posts.filter(
    (p) =>
      !(p as { archived_at?: string | null }).archived_at &&
      p.scheduled_at &&
      !p.published_at &&
      new Date(p.scheduled_at).getTime() >= Date.now(),
  ).length;
  const latestReport = reports.data?.[0];
  const reportCount = reports.data?.length ?? 0;
  const proposalCount = proposals.data?.length ?? 0;
  const about = client?.business_description?.trim() ?? "";
  const scored = clientHealth.isPending || Boolean(clientHealth.health) || clientHealth.isError;

  return (
    <FitPage
      header={
        <ClientHeader clientId={clientId} overview={overview.data} loading={overview.isLoading} />
      }
      contentClassName="flex flex-col gap-4"
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

      <div
        ref={gridRef}
        className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] xl:grid-cols-3"
      >
        <Column label="Pendientes">
          <FichaSection
            {...section("approvals")}
            title="Pendiente de aprobación"
            icon={ClipboardCheck}
            summary={approvals === undefined ? undefined : `${approvals}`}
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
            {...section("upcoming")}
            title="Próximo contenido"
            icon={CalendarClock}
            summary={plural(upcomingCount, "programado", "programados")}
            grow={upcomingCount > 0}
          >
            <UpcomingContentPanel clientId={clientId} />
          </FichaSection>
        </Column>

        {/* Bajo xl, las columnas 2 y 3 comparten una celda: ahí la celda es la que no debe crecer. */}
        <div
          {...FIT_COLUMN}
          className="flex min-w-0 flex-col gap-3 md:min-h-0 md:overflow-y-auto xl:contents"
        >
          <Column label="Cliente" nested>
            {scored && (
              <FichaSection
                {...section("health")}
                title="Salud del cliente"
                icon={HeartPulse}
                info={HEALTH_INFO}
                summary={
                  <HealthBadge health={clientHealth.health} loading={clientHealth.isPending} />
                }
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
              {...section("proposals")}
              title="Propuestas"
              icon={FileText}
              summary={proposals.data ? `${proposalCount}` : undefined}
              sheet={
                proposalCount > PROPOSALS_INLINE
                  ? {
                      label: `Ver todas las propuestas (${proposalCount})`,
                      icon: PanelRightOpen,
                      iconOnly: true,
                      wide: true,
                      content: <ProposalsPanel clientId={clientId} canEdit={canEdit} />,
                    }
                  : undefined
              }
            >
              <ProposalsPanel clientId={clientId} canEdit={canEdit} limit={PROPOSALS_INLINE} />
            </FichaSection>
            <FichaSection
              {...section("reports")}
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
              sheet={
                reportCount > REPORTS_INLINE
                  ? {
                      label: `Ver todos los reportes (${reportCount})`,
                      icon: PanelRightOpen,
                      iconOnly: true,
                      wide: true,
                      content: (
                        <ReportsPanel
                          clientId={clientId}
                          clientName={clientName}
                          canEdit={canEdit}
                        />
                      ),
                    }
                  : undefined
              }
            >
              <ReportsPanel
                clientId={clientId}
                clientName={clientName}
                canEdit={canEdit}
                limit={REPORTS_INLINE}
              />
            </FichaSection>
            {overview.data?.canEdit && (
              <FichaSection
                {...section("monthPlan")}
                title="Plan del mes"
                icon={CalendarRange}
                info={<MonthPlanInfo clientId={clientId} />}
                summary={findPlan(overview.data.billing?.plan_key)?.label ?? "sin plan"}
              >
                <MonthPlanPanel
                  clientId={clientId}
                  planKey={overview.data.billing?.plan_key ?? null}
                  canEdit={overview.data.canEdit}
                />
              </FichaSection>
            )}
            <FichaSection
              {...section("about")}
              title="Sobre la empresa"
              icon={Building2}
              summary={
                about
                  ? about.length > ABOUT_PREVIEW_CHARS
                    ? `${about.slice(0, ABOUT_PREVIEW_CHARS)}…`
                    : about
                  : "sin descripción"
              }
            >
              <BusinessDescription
                clientId={clientId}
                value={client?.business_description ?? ""}
                onSaved={reloadClient}
                clamp
              />
            </FichaSection>
          </Column>

          <Column label="Facturación, contrato y accesos" nested>
            <FichaSection
              {...section("billing")}
              title="Plan y facturación"
              icon={CreditCard}
              summary={overview.data ? billingHeadline(overview.data) : undefined}
              sheet={
                overview.data
                  ? {
                      label: canEdit ? "Editar" : "Ver",
                      icon: canEdit ? Pencil : undefined,
                      content: <BillingCard clientId={clientId} overview={overview.data} />,
                    }
                  : undefined
              }
            >
              <BillingSummary overview={overview} />
            </FichaSection>
            <FichaSection
              {...section("contract")}
              title="Contrato"
              icon={FileSignature}
              summary={
                contract.data === undefined
                  ? undefined
                  : contract.data
                    ? getStatus(contract.data.status).label
                    : "sin contrato"
              }
            >
              <ContractPanel clientId={clientId} />
            </FichaSection>
            <FichaSection
              {...section("access")}
              title="Acceso del cliente"
              icon={Users}
              info={CLIENT_ACCESS_INFO}
              summary={access.data ? plural(access.data.length, "persona", "personas") : undefined}
              sheet={{
                label: "Invitar",
                icon: UserPlus,
                content: <ClientAccessCard clientId={clientId} />,
              }}
            >
              <ClientAccessSummary clientId={clientId} />
            </FichaSection>
            {overview.data && (
              <FichaSection
                {...section("onboardingLink")}
                title="Link de onboarding"
                icon={Link2}
                info={ONBOARDING_LINK_INFO}
                summary={onboardingLinkSummary(overview.data)}
              >
                <OnboardingLinkPanel clientId={clientId} overview={overview.data} />
              </FichaSection>
            )}
            {overview.data && (
              <FichaSection
                {...section("onboarding")}
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
                sheet={
                  canEdit && intake.data
                    ? {
                        label: "Ver todo",
                        wide: true,
                        content: <OnboardingIntakePanel clientId={clientId} canEdit={canEdit} />,
                      }
                    : undefined
                }
              >
                <OnboardingIntakeSummary clientId={clientId} canEdit={canEdit} />
              </FichaSection>
            )}
            <FichaSection
              {...section("reviews")}
              title="Reseñas y testimonios"
              icon={Star}
              info={REVIEWS_INFO}
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
