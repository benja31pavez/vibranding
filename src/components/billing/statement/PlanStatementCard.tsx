import type { ReactNode } from "react";
import { ErrorState, ListSkeleton, Money, StatusBadge, type StatusTone } from "@/components/app";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MEMBERSHIP_STATE_LABEL,
  type Membership,
  type MembershipState,
} from "@/lib/billing/membership";
import { findPlan, planNetLabel, planTotal } from "@/lib/pricing/plans";
import { fmtDay } from "./format";
import { MembershipActions } from "./MembershipActions";
import type { FlowState } from "./PaymentActions";

const STATE_TONE: Readonly<Record<MembershipState, StatusTone>> = {
  sin_plan: "neutral",
  activo: "success",
  por_renovar: "warning",
  finalizado: "neutral",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

function remainingLabel(m: Membership): string | null {
  if (m.daysLeft === null) return null;
  return m.daysLeft === 0 ? "Hoy es el último día" : days(m.daysLeft);
}

export interface PlanStatementCardProps {
  clientId: string;
  membership: Membership | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  flow: FlowState;
  /** Puede iniciar el pago (agencia con edición o el propio cliente). */
  canPay: boolean;
}

/** "Tu plan": plan vigente, período pagado y estado, con Contratar/Renovar. Sin MRR. */
export function PlanStatementCard({
  clientId,
  membership: m,
  loading,
  error,
  onRetry,
  flow,
  canPay,
}: PlanStatementCardProps) {
  const plan = findPlan(m?.planKey);
  const showPlan = Boolean(m && m.state !== "sin_plan" && plan);
  const remaining = m ? remainingLabel(m) : null;

  return (
    <section
      aria-labelledby="tu-plan"
      className="flex min-w-0 flex-col gap-3 rounded-app-lg border border-l-4 border-border-subtle bg-surface p-5 shadow-app-xs"
      style={{ borderLeftColor: "var(--brand-2)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            id="tu-plan"
            className="text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--brand-2)" }}
          >
            Tu plan
          </p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-40" />
          ) : (
            <h2 className="truncate text-lg font-semibold">
              {showPlan && plan ? plan.label : MEMBERSHIP_STATE_LABEL.sin_plan}
            </h2>
          )}
        </div>
        {m && !loading && m.state !== "sin_plan" && (
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {m.onboarding && <StatusBadge status="onboarding" label="Onboarding" tone="info" />}
            <StatusBadge
              status={m.state}
              label={MEMBERSHIP_STATE_LABEL[m.state]}
              tone={STATE_TONE[m.state]}
            />
          </div>
        )}
      </div>

      {loading ? (
        <ListSkeleton rows={4} label="Cargando plan" />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : m ? (
        <>
          {showPlan && plan && (
            <dl className="divide-y divide-border-subtle">
              <Row label="Precio">
                <span className="whitespace-nowrap tabular-nums">{planNetLabel(plan)}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Total con IVA <Money amount={planTotal(plan)} className="text-foreground" />
                </span>
              </Row>
              {m.periodStart && m.periodEnd && (
                <Row label={m.state === "finalizado" ? "Último período" : "Período pagado"}>
                  <span className="whitespace-nowrap">
                    {fmtDay(m.periodStart)} – {fmtDay(m.periodEnd)}
                  </span>
                </Row>
              )}
              {remaining && (
                <Row label="Quedan">
                  <span className={m.state === "por_renovar" ? "text-warning-strong" : undefined}>
                    {remaining}
                  </span>
                  {m.renewed && m.coveredUntil && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      Renovado hasta el {fmtDay(m.coveredUntil)}
                    </span>
                  )}
                </Row>
              )}
              {m.clientSince && <Row label="Cliente desde">{fmtDay(m.clientSince)}</Row>}
            </dl>
          )}
          <MembershipActions clientId={clientId} membership={m} flow={flow} canPay={canPay} />
        </>
      ) : null}
    </section>
  );
}
