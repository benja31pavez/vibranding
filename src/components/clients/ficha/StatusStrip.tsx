import { useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardCheck,
  CreditCard,
  HeartPulse,
  Megaphone,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, MoneyTotals, TONE_CLASSES, type StatusTone } from "@/components/app";
import { EMPTY_CLP_TOTALS, addClp, type ClpTotals } from "@/lib/pricing/plans";
import { HEALTH_LEVEL_META } from "@/lib/health";
import {
  ADS_BILLING_STATE_LABEL,
  ADS_PLATFORM_LABEL,
  adsBillingRows,
  type AdsBillingState,
} from "@/lib/ads-billing/combined";
import { cn } from "@/lib/utils";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { ClientHealthCard, useClientHealth } from "@/components/clients/health";
import { AdsBillingPanel, ADS_BILLING_TONE, useAdsBillingSources } from "./AdsBillingPanel";
import { CampaignAlertsPanel } from "./CampaignAlertsPanel";
import { FichaSheet } from "./FichaSection";
import type { FichaHealth } from "./fichaQueries";

/** Planes que incluyen gestión de campañas en Meta Ads. */
const PLANS_WITH_ADS: readonly string[] = ["crecimiento"];

/** Del peor al mejor estado de pago de pauta. */
const ADS_STATE_RANK: Readonly<Record<AdsBillingState, number>> = {
  rechazado: 0,
  pendiente: 1,
  verificado: 2,
  sin_cuenta: 3,
};

function clpTotals(rows: FichaHealth["payments"]): ClpTotals {
  return rows.reduce<ClpTotals>(
    (acc, p) => addClp(acc, p.currency, Number(p.amount)),
    EMPTY_CLP_TOTALS,
  );
}

/**
 * Estado de "Campañas". Sin Meta conectado no hay alertas que revisar,
 * así que se muestra en tono neutro en vez de un verde engañoso.
 */
function campaignState({
  alerts,
  critical,
  metaConnected,
  planKey,
}: {
  alerts: number;
  critical: number;
  metaConnected: boolean;
  planKey: string | null;
}): { tone: StatusTone; summary: string } {
  if (alerts > 0) {
    return {
      tone: critical > 0 ? "danger" : "warning",
      summary: `${alerts} alerta${alerts === 1 ? "" : "s"} abierta${alerts === 1 ? "" : "s"}`,
    };
  }
  if (planKey && !PLANS_WITH_ADS.includes(planKey))
    return { tone: "neutral", summary: "No incluido en el plan" };
  if (!metaConnected) return { tone: "neutral", summary: "Meta no conectado" };
  return { tone: "success", summary: "Sin alertas abiertas" };
}

type SheetKey = "campaigns" | "health" | "ads";

interface StatusStripProps {
  clientId: string;
  clientName: string;
  health: FichaHealth | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  /** Plan del cliente (client_billing.plan_key); define si Meta Ads está incluido. */
  planKey: string | null;
  canEdit: boolean;
}

/**
 * Franja de estado de la ficha, en una fila: entregas, pagos, campañas, salud y
 * pago de pauta. Cada una lleva a su detalle o lo abre en un panel lateral.
 */
export function StatusStrip({
  clientId,
  clientName,
  health,
  loading,
  error,
  onRetry,
  planKey,
  canEdit,
}: StatusStripProps) {
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const { caps, loading: capsLoading } = useClientCapabilities(clientId);
  const clientHealth = useClientHealth(clientId);
  const ads = useAdsBillingSources(clientId);

  const approvals = health?.approvals.length ?? 0;
  const pending = health?.payments.filter((p) => p.status === "pending") ?? [];
  const overdue = health?.payments.filter((p) => p.status === "overdue") ?? [];
  const alerts = health?.alerts ?? [];
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const campaigns = campaignState({
    alerts: alerts.length,
    critical,
    metaConnected: caps.meta_connected,
    planKey,
  });
  const adsRows = ads.data ? adsBillingRows(ads.data) : [];
  const sortedAds = [...adsRows].sort((a, b) => ADS_STATE_RANK[a.state] - ADS_STATE_RANK[b.state]);
  const worstAds = sortedAds[0];
  // Las plataformas sin cuenta solo se nombran si ninguna tiene cuenta.
  const shownAds = sortedAds.some((r) => r.state !== "sin_cuenta")
    ? sortedAds.filter((r) => r.state !== "sin_cuenta")
    : sortedAds;
  const scored = clientHealth.isPending || Boolean(clientHealth.health);
  const close = (open: boolean) => !open && setSheet(null);

  if (error && !loading) {
    return <ErrorState message={error.message} onRetry={onRetry} />;
  }

  return (
    <>
      <ul
        aria-label="Estado del cliente"
        className={cn(
          "grid grid-cols-1 gap-2 sm:grid-cols-2",
          scored ? "md:grid-cols-5" : "md:grid-cols-4",
        )}
      >
        <Chip
          icon={ClipboardCheck}
          title="Entregas"
          loading={loading}
          tone={approvals > 0 ? "warning" : "success"}
          summary={approvals > 0 ? `${approvals} por aprobar` : "Nada pendiente de aprobación"}
          target={(p) => <Link to="/clients/$clientId/deliverables" params={{ clientId }} {...p} />}
          actionLabel="Ver entregas"
        />
        <Chip
          icon={Wallet}
          title="Pagos"
          loading={loading}
          tone={overdue.length > 0 ? "danger" : pending.length > 0 ? "warning" : "success"}
          summary={
            overdue.length + pending.length === 0 ? (
              "Sin cobros abiertos"
            ) : (
              <span className="space-x-1">
                {overdue.length > 0 && (
                  <span>
                    {overdue.length} vencido{overdue.length === 1 ? "" : "s"} (
                    <MoneyTotals totals={clpTotals(overdue)} />)
                  </span>
                )}
                {overdue.length > 0 && pending.length > 0 && <span>·</span>}
                {pending.length > 0 && (
                  <span>
                    {pending.length} pendiente{pending.length === 1 ? "" : "s"} (
                    <MoneyTotals totals={clpTotals(pending)} />)
                  </span>
                )}
              </span>
            )
          }
          target={(p) => (
            <Link
              to="/clients/$clientId/facturacion"
              params={{ clientId }}
              search={{ tab: "pagos" }}
              {...p}
            />
          )}
          actionLabel="Ver pagos"
        />
        <Chip
          icon={Megaphone}
          title="Campañas"
          loading={loading || capsLoading}
          tone={campaigns.tone}
          summary={campaigns.summary}
          target={sheetButton(() => setSheet("campaigns"))}
          actionLabel="Ver campañas"
        />
        {scored && (
          <Chip
            icon={HeartPulse}
            title="Salud"
            loading={clientHealth.isPending}
            tone={
              clientHealth.isError
                ? "danger"
                : clientHealth.health
                  ? HEALTH_LEVEL_META[clientHealth.health.level].tone
                  : "neutral"
            }
            summary={
              clientHealth.isError
                ? "No pudimos calcularla"
                : clientHealth.health
                  ? `${HEALTH_LEVEL_META[clientHealth.health.level].label} · ${clientHealth.health.score}/100`
                  : "—"
            }
            target={sheetButton(() => setSheet("health"))}
            actionLabel="Ver salud del cliente"
          />
        )}
        <Chip
          icon={CreditCard}
          title="Pago de pauta"
          loading={ads.isLoading}
          tone={ads.error ? "danger" : worstAds ? ADS_BILLING_TONE[worstAds.state] : "neutral"}
          summary={
            ads.error
              ? "No pudimos cargarlo"
              : shownAds
                  .map(
                    (r) =>
                      `${ADS_PLATFORM_LABEL[r.platform].replace(" Ads", "")}: ${ADS_BILLING_STATE_LABEL[r.state]}`,
                  )
                  .join(" · ") || "—"
          }
          target={sheetButton(() => setSheet("ads"))}
          actionLabel="Ver pago de pauta"
        />
      </ul>

      <FichaSheet
        open={sheet === "campaigns"}
        onOpenChange={close}
        title={alerts.length > 0 ? `Alertas de campañas (${alerts.length})` : "Campañas"}
        wide
      >
        <div className="space-y-3">
          {alerts.length > 0 ? (
            <CampaignAlertsPanel alerts={alerts} canEdit={canEdit} />
          ) : (
            <p className="text-sm text-muted-foreground">{campaigns.summary}</p>
          )}
          <Link
            to="/clients/$clientId/meta-ads"
            params={{ clientId }}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Ver campañas <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        </div>
      </FichaSheet>
      <FichaSheet
        open={sheet === "health"}
        onOpenChange={close}
        title="Salud del cliente"
        info={HEALTH_INFO}
      >
        <ClientHealthCard clientId={clientId} />
      </FichaSheet>
      <FichaSheet open={sheet === "ads"} onOpenChange={close} title="Pago de pauta">
        <AdsBillingPanel clientId={clientId} clientName={clientName} canEdit={canEdit} />
      </FichaSheet>
    </>
  );
}

export const HEALTH_INFO =
  "Señales de retención: cobros, aprobaciones, alertas, reportes, actividad y renovación.";

interface ChipTargetProps {
  className: string;
  title: string;
  children: ReactNode;
}
type ChipTarget = (props: ChipTargetProps) => ReactNode;

/** La tarjeta abre un panel lateral. */
function sheetButton(onClick: () => void): ChipTarget {
  return (p) => <button type="button" aria-haspopup="dialog" onClick={onClick} {...p} />;
}

interface ChipProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  summary: ReactNode;
  tone: StatusTone;
  loading: boolean;
  target: ChipTarget;
  /** Nombre de la acción (antes era el link de la tarjeta). */
  actionLabel: string;
}

const CHIP_CLS =
  "flex h-full w-full min-w-0 items-center gap-2.5 rounded-app-lg border border-border-subtle bg-surface px-3 py-2 text-left shadow-app-xs transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Chip({ icon: Icon, title, summary, tone, loading, target, actionLabel }: ChipProps) {
  return (
    <li className="min-w-0">
      {target({
        className: CHIP_CLS,
        title: actionLabel,
        children: (
          <>
            <span
              aria-hidden
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                loading ? "bg-muted" : TONE_CLASSES[tone].dot,
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Icon aria-hidden className="h-3.5 w-3.5" /> {title}
              </span>
              {loading ? (
                <Skeleton className="mt-1 h-4 w-24" />
              ) : (
                <span className="block truncate text-sm font-medium tabular-nums text-foreground">
                  {summary}
                </span>
              )}
            </span>
            <span className="sr-only">. {actionLabel}</span>
          </>
        ),
      })}
    </li>
  );
}
