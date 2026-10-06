import type { ReactNode } from "react";
import { CreditCard } from "lucide-react";
import { ErrorState, ListSkeleton, Money, Panel, StatusBadge } from "@/components/app";
import { fmtDay } from "@/components/billing/statement/format";
import { MEMBERSHIP_STATE_LABEL, membershipMrr, type Membership } from "@/lib/billing/membership";
import { useMembership } from "@/lib/billing/membership.functions";
import { findPlan, planNetLabel } from "@/lib/pricing/plans";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

const STATE_TONE = {
  sin_plan: "neutral",
  pago_unico: "info",
  activo: "success",
  por_renovar: "warning",
  finalizado: "neutral",
} as const;

function Rows({ m }: { m: Membership }) {
  const plan = m.state !== "sin_plan" ? findPlan(m.planKey) : null;
  return (
    <dl className="divide-y divide-border-subtle">
      <Row label="Estado">
        <span className="inline-flex flex-wrap justify-end gap-1.5">
          {m.onboarding && <StatusBadge status="onboarding" label="Onboarding" tone="info" />}
          <StatusBadge
            status={m.state}
            label={MEMBERSHIP_STATE_LABEL[m.state]}
            tone={STATE_TONE[m.state]}
          />
        </span>
      </Row>
      <Row label="Plan">{plan ? plan.label : "Sin plan vigente"}</Row>
      {plan && <Row label="Precio">{planNetLabel(plan)}</Row>}
      {m.periodStart && m.periodEnd && (
        <Row label={m.state === "finalizado" ? "Último período" : "Período pagado"}>
          {fmtDay(m.periodStart)} – {fmtDay(m.periodEnd)}
        </Row>
      )}
      {m.oneTimePaidAt && (
        <Row label="Proyecto">Pago único · Marca + Web ({fmtDay(m.oneTimePaidAt)})</Row>
      )}
      <Row label="MRR neto">
        <Money amount={membershipMrr(m)} />
      </Row>
      <Row label="Cliente desde">{m.clientSince ? fmtDay(m.clientSince) : "—"}</Row>
    </dl>
  );
}

/**
 * "Plan y facturación" (solo lectura). Todo se deriva de los pagos confirmados
 * por Flow: el plan lo elige y paga el cliente en Facturación; aquí no se edita
 * plan, MRR, día de cobro, "cliente desde" ni estado comercial.
 */
export function BillingCard({ clientId }: { clientId: string }) {
  const membership = useMembership(clientId);
  return (
    <Panel title="Plan y facturación" icon={CreditCard}>
      {membership.isPending ? (
        <ListSkeleton rows={5} label="Cargando plan" />
      ) : membership.error ? (
        <ErrorState message={membership.error.message} onRetry={() => void membership.refetch()} />
      ) : (
        <>
          <Rows m={membership.data} />
          <p className="mt-3 text-xs text-muted-foreground">
            Se actualiza solo con cada pago confirmado en Facturación.
          </p>
        </>
      )}
    </Panel>
  );
}
