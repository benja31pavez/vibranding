import type { Plan } from "@/lib/pricing/plans";
import type { ServiceContent } from "@/lib/services/content";
import { servicePlans } from "@/lib/services/seo";
import { formatClp } from "@/lib/site";

/** "pago único" o "al mes · mínimo 3 meses". */
export function planPeriod(plan: Plan): string {
  if (plan.billing === "one_time") return "pago único";
  return plan.minMonths ? `al mes · mínimo ${plan.minMonths} meses` : "al mes";
}

/** Frase de precio del hero: "Desde $129.990 + IVA al mes." (precio neto). */
export function priceHeadline(service: ServiceContent): string {
  if (service.pricing.kind === "quote") return `${service.pricing.label} · servicio adicional`;
  const plans = servicePlans(service);
  if (plans.length === 0) return "";
  const cheapest = plans.reduce((min, p) => (p.netPrice < min.netPrice ? p : min));
  const period = cheapest.billing === "one_time" ? "pago único" : "al mes";
  const lead = plans.length > 1 ? "Desde " : "";
  return `${lead}${formatClp(cheapest.netPrice)} + IVA ${period}.`;
}
