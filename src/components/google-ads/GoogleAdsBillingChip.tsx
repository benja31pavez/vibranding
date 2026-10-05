import { StatusBadge } from "@/components/app";
import {
  BILLING_VERDICT_LABEL,
  BILLING_VERDICT_TONE,
  isBillingVerdict,
  type BillingVerdict,
} from "@/lib/google-ads/billing";

/** Chip del medio de pago de Google Ads: Verificado / Pendiente / Rechazado / Sin cuenta. */
export function GoogleAdsBillingChip({
  verdict,
  className,
}: {
  verdict: string | null | undefined;
  className?: string;
}) {
  const v: BillingVerdict = isBillingVerdict(verdict) ? verdict : "sin_cuenta";
  return (
    <StatusBadge
      status={`gads-billing-${v}`}
      label={`Pago Google Ads: ${BILLING_VERDICT_LABEL[v]}`}
      tone={BILLING_VERDICT_TONE[v]}
      className={className}
    />
  );
}
