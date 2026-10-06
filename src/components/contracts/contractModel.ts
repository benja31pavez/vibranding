import type { ServiceKey } from "@/components/PricingPanel";
import { findAddon } from "@/lib/pricing/addons";
import type { Plan } from "@/lib/pricing/plans";
import { withIva } from "@/lib/pricing/iva";

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

/** Totales NETOS (sin IVA) del contrato en preparación. */
export interface ContractTotals {
  oneTime: number;
  monthly: number;
  /** Total a pagar: suma del IVA aplicado por línea (igual a lo que se guarda y cobra). */
  oneTimeTotal: number;
  monthlyTotal: number;
}

/**
 * Marca en `agency_snapshot.price_basis` de los contratos creados con precios
 * netos + IVA (desde 2026-10). En esos contratos cada línea y los totales
 * guardados son el TOTAL con IVA (lo que paga el cliente) y el documento muestra
 * neto, IVA 19 % y total a pagar. Contratos anteriores (vat_included o sin marca)
 * se muestran igual que siempre.
 */
export const NET_PLUS_IVA_BASIS = "neto_mas_iva";

/** Línea de contrato a partir de montos NETOS: guarda el total con IVA. */
export function contractLineFromNet<T extends { one_time_price: number; monthly_price: number }>(
  line: T,
): T {
  return {
    ...line,
    one_time_price: line.one_time_price > 0 ? withIva(line.one_time_price) : 0,
    monthly_price: line.monthly_price > 0 ? withIva(line.monthly_price) : 0,
  };
}

/**
 * Totales NETOS del contrato en preparación: plan elegido + adicionales marcados.
 * Los precios de los adicionales son fijos y netos (addons.ts), igual que los planes.
 */
export function computeDraftTotals(
  plan: Plan | null,
  addons: ReadonlySet<ServiceKey>,
): ContractTotals {
  const planOneTime = plan?.billing === "one_time" ? plan.netPrice : 0;
  const planMonthly = plan?.billing === "monthly" ? plan.netPrice : 0;
  const gross = (net: number) => (net > 0 ? withIva(net) : 0);
  return Array.from(addons).reduce<ContractTotals>(
    (acc, key) => {
      const oneTime = findAddon(key)?.setupNet ?? 0;
      const monthly = findAddon(key)?.monthlyNet ?? 0;
      return {
        oneTime: acc.oneTime + oneTime,
        monthly: acc.monthly + monthly,
        oneTimeTotal: acc.oneTimeTotal + gross(oneTime),
        monthlyTotal: acc.monthlyTotal + gross(monthly),
      };
    },
    {
      oneTime: planOneTime,
      monthly: planMonthly,
      oneTimeTotal: gross(planOneTime),
      monthlyTotal: gross(planMonthly),
    },
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
