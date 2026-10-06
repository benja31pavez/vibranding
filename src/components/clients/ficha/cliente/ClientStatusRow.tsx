import { Link } from "@tanstack/react-router";
import { ClipboardCheck, CreditCard, Flag, Megaphone, Wallet } from "lucide-react";
import { Money, type StatusTone } from "@/components/app";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { adsBillingRows } from "@/lib/ads-billing/combined";
import { isCyclePlan } from "@/lib/delivery/planCycle";
import type { PortalApprovals, PortalBilling, SectionResult } from "@/lib/portal/model";
import { cn } from "@/lib/utils";
import { ADS_BILLING_TONE, useAdsBillingSources } from "../AdsBillingPanel";
import { AdsBillingLines, Chip } from "../StatusStrip";
import { ADS_STATE_RANK, PLANS_WITH_ADS } from "../statusShared";
import type { CycleProgress } from "./clientFichaQueries";
import { useActiveCampaignCount } from "./clientFichaQueries";

interface ClientStatusRowProps {
  clientId: string;
  planKey: string | null;
  loading: boolean;
  approvals: SectionResult<PortalApprovals> | undefined;
  billing: SectionResult<PortalBilling> | undefined;
  cycle: CycleProgress | undefined;
  cycleLoading: boolean;
}

function planChip(planKey: string | null, cycle: CycleProgress | undefined) {
  if (!cycle || cycle.total === 0) {
    return {
      tone: "neutral" as StatusTone,
      summary: isCyclePlan(planKey) ? "Aún sin tareas del mes" : "Sin ciclo mensual",
    };
  }
  const pct = Math.round((cycle.done / cycle.total) * 100);
  return {
    tone: (cycle.done === cycle.total ? "success" : "info") as StatusTone,
    summary: (
      <span className="flex items-center gap-2">
        <span className="shrink-0">
          {cycle.done} de {cycle.total} listas
        </span>
        <span
          aria-hidden
          className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </span>
      </span>
    ),
  };
}

function paymentsChip(billing: SectionResult<PortalBilling> | undefined) {
  if (!billing) return { tone: "neutral" as StatusTone, summary: "—" };
  if (!billing.ok) return { tone: "danger" as StatusTone, summary: "No pudimos cargarlos" };
  const overdue = billing.data.open.filter((p) => p.status === "overdue");
  const first = billing.data.open[0];
  if (!first) return { tone: "success" as StatusTone, summary: "Al día" };
  const count = billing.data.open.length;
  return {
    tone: (overdue.length > 0 ? "danger" : "warning") as StatusTone,
    summary:
      count > 1 ? (
        overdue.length > 0 ? (
          `${overdue.length} vencido${overdue.length === 1 ? "" : "s"} de ${count}`
        ) : (
          `${count} por pagar`
        )
      ) : (
        <span>
          <Money amount={first.amount} currency={first.currency} />{" "}
          {overdue.length > 0 ? "vencido" : "por pagar"}
        </span>
      ),
  };
}

/**
 * Fila de estado de la ficha del cliente: plan del mes, entregas, pagos,
 * campañas y pago de pauta. Sin salud, MRR ni alertas internas.
 */
export function ClientStatusRow({
  clientId,
  planKey,
  loading,
  approvals,
  billing,
  cycle,
  cycleLoading,
}: ClientStatusRowProps) {
  const { caps, loading: capsLoading } = useClientCapabilities(clientId);
  const campaigns = useActiveCampaignCount(clientId);
  const ads = useAdsBillingSources(clientId);

  const pending =
    approvals?.ok === true ? approvals.data.deliverables.length + approvals.data.posts.length : 0;
  const plan = planChip(planKey, cycle);
  const payments = paymentsChip(billing);
  const withAds = !planKey || PLANS_WITH_ADS.includes(planKey);
  const active = campaigns.data ?? 0;
  const campaignSummary = !withAds
    ? "No incluido en el plan"
    : !caps.meta_connected
      ? "Meta no conectado"
      : active > 0
        ? `${active} activa${active === 1 ? "" : "s"}`
        : "Sin campañas activas";
  const adsRows = ads.data ? adsBillingRows(ads.data) : [];
  const sortedAds = [...adsRows].sort((a, b) => ADS_STATE_RANK[a.state] - ADS_STATE_RANK[b.state]);
  const worstAds = sortedAds[0];

  return (
    <ul
      aria-label="Estado del cliente"
      className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-5")}
    >
      <Chip
        icon={Flag}
        title="Plan del mes"
        loading={cycleLoading}
        tone={plan.tone}
        summary={plan.summary}
        target={(p) => <Link to="/clients/$clientId/plan" params={{ clientId }} {...p} />}
        actionLabel="Ver plan"
      />
      <Chip
        icon={ClipboardCheck}
        title="Entregas"
        loading={loading}
        tone={approvals?.ok === false ? "danger" : pending > 0 ? "warning" : "success"}
        summary={
          approvals?.ok === false
            ? "No pudimos cargarlas"
            : pending > 0
              ? `${pending} por aprobar`
              : "Sin pendientes"
        }
        target={(p) => <Link to="/clients/$clientId/deliverables" params={{ clientId }} {...p} />}
        actionLabel="Ver entregas"
      />
      <Chip
        icon={Wallet}
        title="Pagos"
        loading={loading}
        tone={payments.tone}
        summary={payments.summary}
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
        loading={capsLoading || campaigns.isLoading}
        tone={withAds && caps.meta_connected && active > 0 ? "success" : "neutral"}
        summary={campaigns.error ? "No pudimos cargarlas" : campaignSummary}
        target={(p) => <Link to="/clients/$clientId/meta-ads" params={{ clientId }} {...p} />}
        actionLabel="Ver campañas"
      />
      <Chip
        icon={CreditCard}
        title="Pago de pauta"
        loading={ads.isLoading}
        tone={ads.error ? "danger" : worstAds ? ADS_BILLING_TONE[worstAds.state] : "neutral"}
        hideDot={!ads.error && sortedAds.length > 0}
        summary={
          ads.error ? (
            "No pudimos cargarlo"
          ) : sortedAds.length === 0 ? (
            "—"
          ) : (
            <AdsBillingLines rows={sortedAds} />
          )
        }
        target={(p) => <Link to="/clients/$clientId/meta-ads" params={{ clientId }} {...p} />}
        actionLabel="Ver pago de pauta"
      />
    </ul>
  );
}
