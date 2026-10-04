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

/**
 * Meta mensual de MRR de la agencia (CLP, IVA incluido). La usa la pantalla
 * "Hoy" para la barra de avance. Cambia este valor cuando se redefina la meta.
 */
export const META_MRR_CLP = 1_000_000;

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

const CLP_FORMATTER = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: DEFAULT_CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const PLAIN_FORMATTER = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

function toAmount(amount: unknown): number {
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
}

/** Formatea un monto en CLP (es-CL, sin decimales): `$149.990`. Única moneda de la plataforma. */
export function formatMoney(amount: number): string {
  return CLP_FORMATTER.format(toAmount(amount));
}

/** Número sin símbolo de moneda (`200`, `0,15`), para montos antiguos que no están en CLP. */
export function formatPlainAmount(amount: number): string {
  return PLAIN_FORMATTER.format(toAmount(amount));
}

/** Código en mayúsculas; vacío o nulo se interpreta como CLP. */
export function normalizeCurrency(currency: string | null | undefined): string {
  return (currency ?? "").trim().toUpperCase() || DEFAULT_CURRENCY;
}

/** true si el registro trae una moneda distinta de CLP (dato antiguo por limpiar). */
export function isLegacyCurrency(currency: string | null | undefined): boolean {
  return normalizeCurrency(currency) !== DEFAULT_CURRENCY;
}

/** Etiqueta discreta para registros antiguos: `Moneda antigua (USD)`. */
export function legacyCurrencyLabel(currency: string | null | undefined): string {
  return `Moneda antigua (${normalizeCurrency(currency)})`;
}

export function planPriceLabel(plan: Plan): string {
  const base = formatMoney(plan.price);
  if (plan.billing === "one_time") return `${base} pago único`;
  return plan.minMonths ? `${base}/mes · mínimo ${plan.minMonths} meses` : `${base}/mes`;
}

/**
 * Total en CLP. Los montos en otra moneda (registros antiguos o cuentas de Meta
 * en otra moneda) nunca se suman: solo se anotan sus códigos para avisarlo.
 */
export interface ClpTotals {
  readonly clp: number;
  readonly excludedCurrencies: readonly string[];
}

export const EMPTY_CLP_TOTALS: ClpTotals = { clp: 0, excludedCurrencies: [] };

export function addClp(totals: ClpTotals, currency: string | null | undefined, amount: number): ClpTotals {
  if (!isLegacyCurrency(currency)) return { ...totals, clp: totals.clp + toAmount(amount) };
  const code = normalizeCurrency(currency);
  if (totals.excludedCurrencies.includes(code)) return totals;
  return { ...totals, excludedCurrencies: [...totals.excludedCurrencies, code] };
}

export function mergeClpTotals(a: ClpTotals, b: ClpTotals): ClpTotals {
  const extra = b.excludedCurrencies.filter((c) => !a.excludedCurrencies.includes(c));
  return { clp: a.clp + b.clp, excludedCurrencies: [...a.excludedCurrencies, ...extra] };
}

/** `$129.990`, con nota si se dejaron fuera montos en otra moneda. */
export function formatClpTotals(totals: ClpTotals): string {
  const base = formatMoney(totals.clp);
  if (totals.excludedCurrencies.length === 0) return base;
  return `${base} (sin incluir montos en ${totals.excludedCurrencies.join(", ")})`;
}
