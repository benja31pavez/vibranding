/**
 * Oferta comercial de VIBRANDING SpA (Chile).
 *
 * Los planes son fijos y viven en código (no en la base de datos): la tabla
 * `service_pricing` tiene un CHECK sobre `service_key` que solo admite las claves
 * antiguas, así que los planes no se pueden guardar ahí sin una migración.
 * Los servicios adicionales (chatbot, landing extra) sí usan `service_pricing`
 * y tienen precio editable.
 *
 * Todos los precios están en CLP con IVA incluido.
 */

export const DEFAULT_CURRENCY = "CLP";
export const VAT_RATE = 0.19;

export const AGENCY_DEFAULTS = {
  name: "VIBRANDING",
  legal_name: "VIBRANDING SpA",
  tax_id: "78.505.344-3",
  address: "Las Condes, Santiago de Chile",
  email: "",
  jurisdiction: "los tribunales ordinarios de justicia de Santiago de Chile",
  governing_law: "las leyes de la República de Chile",
} as const;

export type PlanKey = "marca-web" | "contenido" | "crecimiento";
export type Billing = "one_time" | "monthly";

export interface Plan {
  key: PlanKey;
  label: string;
  /** Precio bruto (IVA incluido) en CLP. */
  price: number;
  billing: Billing;
  /** Meses mínimos de permanencia (solo planes mensuales). */
  minMonths: number | null;
  description: string;
  note: string | null;
}

export const PLANS: readonly Plan[] = [
  {
    key: "marca-web",
    label: "Marca + Web",
    price: 149_990,
    billing: "one_time",
    minMonths: null,
    description: "Identidad de marca y sitio web listo para recibir clientes.",
    note: null,
  },
  {
    key: "contenido",
    label: "Plan Contenido",
    price: 129_990,
    billing: "monthly",
    minMonths: 3,
    description: "Calendario, diseño y publicación de contenido para Instagram.",
    note: null,
  },
  {
    key: "crecimiento",
    label: "Plan Crecimiento",
    price: 249_990,
    billing: "monthly",
    minMonths: 3,
    description: "Contenido + campañas en Meta Ads + seguimiento de leads.",
    note: "La inversión en pauta (Meta Ads) la paga directamente el cliente.",
  },
];

export function findPlan(key: string | null | undefined): Plan | null {
  return PLANS.find((p) => p.key === key) ?? null;
}

export interface VatBreakdown {
  gross: number;
  net: number;
  vat: number;
}

/** Desglosa un monto con IVA incluido: neto = round(bruto / 1,19). */
export function splitVat(gross: number): VatBreakdown {
  const safeGross = Number.isFinite(gross) ? Math.round(gross) : 0;
  const net = Math.round(safeGross / (1 + VAT_RATE));
  return { gross: safeGross, net, vat: safeGross - net };
}

/** Monedas sin decimales en la práctica. */
const ZERO_DECIMAL = new Set(["CLP", "COP", "PYG", "JPY", "KRW"]);

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

/**
 * Formatea montos en es-CL. CLP sin decimales: `$149.990`.
 * Otras monedas: con su código (`US$12,50`, `€ 10,00`, …).
 */
export function formatMoney(currency: string | null | undefined, amount: number): string {
  const code = (currency ?? DEFAULT_CURRENCY).trim().toUpperCase() || DEFAULT_CURRENCY;
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const decimals = currencyDecimals(code);
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString("es-CL", { maximumFractionDigits: decimals })}`;
  }
}

export function planPriceLabel(plan: Plan): string {
  const base = formatMoney(DEFAULT_CURRENCY, plan.price);
  if (plan.billing === "one_time") return `${base} pago único`;
  return plan.minMonths ? `${base}/mes · mínimo ${plan.minMonths} meses` : `${base}/mes`;
}

/** Montos agrupados por código de moneda (nunca se suman monedas distintas). */
export type MoneyByCurrency = Readonly<Record<string, number>>;

export function normalizeCurrency(currency: string | null | undefined): string {
  return (currency ?? "").trim().toUpperCase() || DEFAULT_CURRENCY;
}

export function addMoney(
  totals: MoneyByCurrency,
  currency: string | null | undefined,
  amount: number,
): MoneyByCurrency {
  const key = normalizeCurrency(currency);
  return { ...totals, [key]: (totals[key] ?? 0) + (Number(amount) || 0) };
}

/** `$129.990 · US$50,00` — o `$0` si no hay montos. */
export function formatMoneyTotals(totals: MoneyByCurrency): string {
  const entries = Object.entries(totals).filter(([, v]) => v !== 0);
  if (entries.length === 0) return formatMoney(DEFAULT_CURRENCY, 0);
  return entries.map(([cur, v]) => formatMoney(cur, v)).join(" · ");
}
