import type { ServicePricing, ServiceKey } from "@/components/PricingPanel";
import type { Plan } from "@/lib/pricing/plans";

export type ContractStatus = "draft" | "sent" | "signed" | "cancelled";

export const CONTRACT_STATUS_OPTIONS: ReadonlyArray<{ value: ContractStatus; label: string }> = [
  { value: "draft", label: "Borrador" },
  { value: "sent", label: "Enviado" },
  { value: "signed", label: "Firmado" },
  { value: "cancelled", label: "Cancelado" },
];

export interface ContractServiceLine {
  service_key: string;
  label: string;
  one_time_price: number;
  monthly_price: number;
  included_text: string | null;
  min_months?: number | null;
}

export interface ClientContract {
  id: string;
  client_id: string;
  title: string;
  status: ContractStatus;
  currency: string;
  payment_due_days: number;
  agency_snapshot: any;
  client_snapshot: any;
  services_snapshot: ContractServiceLine[];
  clauses_snapshot: any[];
  total_one_time: number;
  total_monthly: number;
  effective_date: string | null;
  signed_at: string | null;
  notes: string | null;
  created_at: string;
}

/** Datos legales del cliente que se copian al contrato. */
export interface ClientLegalData {
  legalName: string;
  taxId: string;
  address: string;
  email: string;
}

export const EMPTY_LEGAL_DATA: ClientLegalData = {
  legalName: "",
  taxId: "",
  address: "",
  email: "",
};

export interface ContractTotals {
  oneTime: number;
  monthly: number;
}

/** Un adicional solo se puede sumar si tiene algún precio configurado en Precios. */
export function addonHasPrice(row: ServicePricing | undefined): boolean {
  if (!row) return false;
  return Number(row.one_time_price) > 0 || Number(row.monthly_price) > 0;
}

/** Totales del contrato en preparación: plan elegido + adicionales marcados. */
export function computeDraftTotals(
  plan: Plan | null,
  addons: ReadonlySet<ServiceKey>,
  services: Record<ServiceKey, ServicePricing>,
): ContractTotals {
  const planOneTime = plan?.billing === "one_time" ? plan.price : 0;
  const planMonthly = plan?.billing === "monthly" ? plan.price : 0;
  return Array.from(addons).reduce<ContractTotals>(
    (acc, key) => ({
      oneTime: acc.oneTime + Number(services[key]?.one_time_price ?? 0),
      monthly: acc.monthly + Number(services[key]?.monthly_price ?? 0),
    }),
    { oneTime: planOneTime, monthly: planMonthly },
  );
}

/** "Plan Crecimiento + 1 adicional" a partir del detalle guardado en el contrato. */
export function contractSummaryLabel(services: readonly ContractServiceLine[] | null): string {
  const lines = services ?? [];
  if (lines.length === 0) return "Sin servicios";
  const [first, ...rest] = lines;
  if (rest.length === 0) return first.label;
  return `${first.label} + ${rest.length} ${rest.length === 1 ? "adicional" : "adicionales"}`;
}
