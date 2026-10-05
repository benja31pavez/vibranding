import { CheckCircle2, CreditCard, ExternalLink, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Money, StatusBadge } from "@/components/app";
import { periodLabel } from "@/lib/billing/dates";
import {
  INTERVAL_LABEL,
  PAYMENT_STATUS_META,
  documentTypeLabel,
  formatShortDate,
  type PortalBilling,
  type PortalPayment,
  type SectionResult,
} from "@/lib/portal/model";
import { PortalSection, SectionState } from "./PortalSection";

interface BillingSectionProps {
  readOnly: boolean;
  loading: boolean;
  result: SectionResult<PortalBilling> | undefined;
  onRetry: () => void;
  retrying: boolean;
}

/** Mi plan y pagos: plan activo, cobros por pagar/vencidos con botón "Pagar" e historial corto. */
export function BillingSection({
  readOnly,
  loading,
  result,
  onRetry,
  retrying,
}: BillingSectionProps) {
  return (
    <PortalSection id="pagos" title="Mi plan y pagos" icon={CreditCard}>
      <SectionState
        loading={loading}
        result={result}
        onRetry={onRetry}
        retrying={retrying}
        skeletonRows={3}
      >
        {(billing) => (
          <div className="space-y-5">
            {billing.plan && (
              <div className="rounded-app-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">Tu plan</p>
                <p className="mt-1 text-lg font-semibold tracking-tight">{billing.plan.label}</p>
                <p className="text-sm text-muted-foreground">
                  <Money amount={billing.plan.amountClp} className="font-medium text-foreground" />{" "}
                  {INTERVAL_LABEL[billing.plan.interval] ?? ""} (total con IVA)
                  {billing.plan.nextChargeDate
                    ? ` · próximo cobro el ${formatShortDate(billing.plan.nextChargeDate)}`
                    : ""}
                </p>
              </div>
            )}

            {billing.open.length === 0 ? (
              <EmptyState
                size="compact"
                icon={CheckCircle2}
                title="Estás al día con tus pagos"
                description="No tienes cobros pendientes. ¡Gracias!"
              />
            ) : (
              <ul className="space-y-3">
                {billing.open.map((p) => (
                  <PaymentRow key={p.id} payment={p} readOnly={readOnly} />
                ))}
              </ul>
            )}

            {billing.recentPaid.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Últimos pagos
                </h3>
                <ul className="divide-y divide-border-subtle text-sm">
                  {billing.recentPaid.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                      <span className="min-w-0 break-words text-foreground/90">
                        {paymentTitle(p)}
                      </span>
                      <Money
                        amount={p.amount}
                        currency={p.currency}
                        className="shrink-0 font-medium"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Receipt aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ¿Necesitas tu contrato, una boleta o una factura? Pídesela a tu equipo de Vibranding y
              te la enviamos.
            </p>
          </div>
        )}
      </SectionState>
    </PortalSection>
  );
}

function paymentTitle(p: PortalPayment): string {
  const doc = documentTypeLabel(p.documentType);
  const period = p.period ? `Mensualidad de ${periodLabel(p.period)}` : "Cobro";
  return doc ? `${period} · ${doc}` : period;
}

function PaymentRow({ payment, readOnly }: { payment: PortalPayment; readOnly: boolean }) {
  const meta = PAYMENT_STATUS_META[payment.status];
  return (
    <li className="rounded-app-lg border border-border-subtle bg-bg p-4 shadow-app-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{paymentTitle(payment)}</p>
          {payment.dueDate && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Vence el {formatShortDate(payment.dueDate)}
            </p>
          )}
        </div>
        <StatusBadge
          status={payment.status}
          label={meta.label}
          tone={meta.tone}
          className="shrink-0"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Money
          amount={payment.amount}
          currency={payment.currency}
          className="text-2xl font-semibold tracking-tight"
        />
        {payment.paymentUrl ? (
          readOnly ? (
            <Button className="h-11 min-w-28" disabled>
              Pagar
            </Button>
          ) : (
            <Button asChild className="h-11 min-w-28">
              <a href={payment.paymentUrl} target="_blank" rel="noreferrer">
                Pagar <ExternalLink aria-hidden className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
          )
        ) : (
          <span className="text-xs text-muted-foreground">Te enviaremos el link de pago.</span>
        )}
      </div>
    </li>
  );
}
