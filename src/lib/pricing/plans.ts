/**
 * Oferta comercial de VIBRANDING SpA (Chile).
 *
 * Los planes son fijos y viven en código (no en la base de datos): la tabla
 * `service_pricing` tiene un CHECK sobre `service_key` que solo admite las claves
 * antiguas, así que los planes no se pueden guardar ahí sin una migración.
 * Los servicios adicionales (chatbot, landing extra) sí usan `service_pricing`
 * y tienen precio editable.
 *
 * Los precios son NETOS en CLP: el cliente paga neto + IVA 19 % (ver
 * `./iva.ts`, único lugar donde se calcula el IVA). Etiqueta: "$129.990 + IVA/mes".
 */
import { withIva } from "./iva";

export const DEFAULT_CURRENCY = "CLP";

/**
 * Meta mensual de MRR de la agencia (CLP NETO, sin IVA; el MRR se informa neto).
 * La usa la pantalla "Hoy" para la barra de avance. Cambia este valor cuando se
 * redefina la meta.
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

/** Planes que se publican en el sitio (home, servicios, llms.txt, JSON-LD). */
export type PublicPlanKey = "marca-web" | "contenido" | "crecimiento";
/** Mantención: solo ex clientes (propuestas, contratos, cobros, Plan del mes). */
export type PlanKey = PublicPlanKey | "mantencion";
export type Billing = "one_time" | "monthly";

export interface Plan {
  key: PlanKey;
  label: string;
  /** Precio NETO en CLP (sin IVA). El cliente paga `withIva(netPrice)`. */
  netPrice: number;
  billing: Billing;
  /** Meses mínimos de permanencia (solo planes mensuales). */
  minMonths: number | null;
  description: string;
  note: string | null;
  /**
   * true si se publica en la home, páginas de servicio, llms.txt y JSON-LD.
   * Mantención es solo para clientes que ya trabajaron con nosotros: se ofrece en
   * propuestas, contratos y cobros, pero nunca en las páginas públicas.
   */
  isPublic: boolean;
  /** Solo para ex clientes: la recomendación automática nunca la propone a prospectos nuevos. */
  returningClientsOnly: boolean;
  /**
   * Lo que el plan NO incluye (frases cortas). Única fuente para la home, las
   * páginas de servicio y la propuesta pública. Lo revisa `npm run check:plan-not-included`.
   */
  notIncluded: readonly string[];
}

export const PLANS: readonly Plan[] = [
  {
    key: "marca-web",
    label: "Marca + Web",
    netPrice: 149_990,
    billing: "one_time",
    minMonths: null,
    description: "Identidad de marca y sitio web listo para recibir clientes.",
    note: null,
    isPublic: true,
    returningClientsOnly: false,
    notIncluded: [
      "Contenido mensual para redes",
      "Campañas de anuncios",
      "Cambios a la web después de la entrega (se cotizan aparte)",
    ],
  },
  {
    key: "contenido",
    label: "Plan Contenido",
    netPrice: 129_990,
    billing: "monthly",
    minMonths: 3,
    description: "Calendario, diseño y publicación de contenido para Instagram.",
    note: null,
    isPublic: true,
    returningClientsOnly: false,
    notIncluded: [
      "Campañas de Meta Ads y Google Ads",
      "Inversión en publicidad (pauta)",
      "Landing o sitio web nuevo",
      "Chatbot de WhatsApp (servicio adicional)",
    ],
  },
  {
    key: "crecimiento",
    label: "Plan Crecimiento",
    netPrice: 249_990,
    billing: "monthly",
    minMonths: 3,
    description: "Contenido + campañas en Meta Ads + seguimiento de leads.",
    note: "La inversión en pauta (Meta Ads) la paga directamente el cliente.",
    isPublic: true,
    returningClientsOnly: false,
    notIncluded: [
      "Inversión en publicidad (pauta): la pagas directo a Meta y Google",
      "Landing o sitio web nuevo (servicio adicional)",
      "Chatbot de WhatsApp (servicio adicional)",
    ],
  },
  {
    key: "mantencion",
    label: "Plan Mantención",
    netPrice: 69_990,
    billing: "monthly",
    minMonths: 3,
    description:
      "8 piezas al mes con calendario, aprobación en el portal y reporte mensual. Sin pauta ni campañas.",
    note: "Solo para clientes que ya trabajaron con Vibranding.",
    isPublic: false,
    returningClientsOnly: true,
    notIncluded: [
      "Campañas de anuncios",
      "Publicaciones en Google Business",
      "Reunión mensual",
      "Landing o sitio web nuevo",
    ],
  },
];

export type PublicPlan = Plan & { key: PublicPlanKey };

export function isPublicPlan(plan: Plan | null | undefined): plan is PublicPlan {
  return Boolean(plan?.isPublic);
}

/** Planes que se muestran en las páginas públicas (home, servicios, llms.txt, JSON-LD). */
export const PUBLIC_PLANS: readonly PublicPlan[] = PLANS.filter(isPublicPlan);

export const PLAN_KEYS = PLANS.map((p) => p.key) as [PlanKey, ...PlanKey[]];

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (PLAN_KEYS as readonly string[]).includes(value);
}

/** Lo que el plan no incluye; vacío si no hay plan. */
export function planNotIncluded(key: string | null | undefined): readonly string[] {
  return findPlan(key)?.notIncluded ?? [];
}

export function findPlan(key: string | null | undefined): Plan | null {
  return PLANS.find((p) => p.key === key) ?? null;
}

/** Lo que paga el cliente por el plan (neto + IVA), por mes o pago único. */
export function planTotal(plan: Pick<Plan, "netPrice">): number {
  return withIva(plan.netPrice);
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

/** "$129.990 + IVA/mes" o "$149.990 + IVA (pago único)". */
export function planNetLabel(plan: Pick<Plan, "netPrice" | "billing">): string {
  const base = formatMoney(plan.netPrice);
  return plan.billing === "one_time" ? `${base} + IVA (pago único)` : `${base} + IVA/mes`;
}

/** "$129.990 + IVA/mes · mínimo 3 meses". */
export function planPriceLabel(plan: Plan): string {
  const base = planNetLabel(plan);
  if (plan.billing === "one_time") return base;
  return plan.minMonths ? `${base} · mínimo ${plan.minMonths} meses` : base;
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

export function addClp(
  totals: ClpTotals,
  currency: string | null | undefined,
  amount: number,
): ClpTotals {
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
