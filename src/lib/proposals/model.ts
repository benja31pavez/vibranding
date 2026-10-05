/**
 * Modelo de propuestas comerciales (tabla `proposals`).
 *
 * `items` (jsonb) guarda TODAS las líneas de la propuesta, incluido el plan,
 * para que el texto de aceptación que arma la BD (`accept_proposal`) tenga el
 * detalle completo.
 *
 * Montos guardados: cada `amount` es el TOTAL a pagar de la línea (con IVA), como
 * siempre. Desde 2026-10 los precios de lista son netos: el editor trabaja en
 * neto y guarda `withIva(neto)`; las propuestas anteriores (precio "IVA
 * incluido") se leen tal cual. El neto de cada línea se obtiene con `netOfTotal`.
 *
 * `amount_clp` = total del primer pago (con IVA) = pagos únicos + primer mes de
 * lo mensual. Es lo que se cobra (payments.amount → Flow).
 */
import { z } from "zod";
import { PLAN_KEYS, findPlan, planTotal, type Billing, type PlanKey } from "@/lib/pricing/plans";
import { IVA_LABEL, netOfTotal, withIva } from "@/lib/pricing/iva";
import type { StatusTone } from "@/components/app/status-badge";

export const PROPOSAL_STATUSES = [
  "borrador",
  "enviada",
  "vista",
  "aceptada",
  "rechazada",
  "expirada",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_STATUS_META: Readonly<
  Record<ProposalStatus, { label: string; tone: StatusTone }>
> = {
  borrador: { label: "Borrador", tone: "neutral" },
  enviada: { label: "Enviada", tone: "info" },
  vista: { label: "Vista", tone: "info" },
  aceptada: { label: "Aceptada", tone: "success" },
  rechazada: { label: "Rechazada", tone: "danger" },
  expirada: { label: "Expirada", tone: "warning" },
};

export function isProposalStatus(value: unknown): value is ProposalStatus {
  return typeof value === "string" && (PROPOSAL_STATUSES as readonly string[]).includes(value);
}

/** Días de vigencia por defecto de una propuesta nueva. */
export const DEFAULT_VALIDITY_DAYS = 14;
/** Tope por línea para evitar errores de tipeo (un cero de más). */
export const MAX_ITEM_AMOUNT = 50_000_000;
export const MAX_ITEMS = 20;

export const ProposalItemSchema = z.object({
  type: z.enum(["plan", "extra"]),
  key: z.enum(PLAN_KEYS).optional(),
  label: z.string().trim().min(1).max(120),
  /** Total de la línea en CLP, con IVA (lo que se cobra). Negativo solo para descuentos ("extra"). */
  amount: z.number().int().min(-MAX_ITEM_AMOUNT).max(MAX_ITEM_AMOUNT),
  billing: z.enum(["one_time", "monthly"]),
});
export type ProposalItem = z.infer<typeof ProposalItemSchema>;

export const ProposalItemsSchema = z.array(ProposalItemSchema).max(MAX_ITEMS);

/** Lee `items` de la BD; si el formato no calza devuelve [] (nunca rompe la vista). */
export function parseItems(value: unknown): ProposalItem[] {
  const parsed = ProposalItemsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Línea del plan al precio vigente: neto de lista + IVA. */
export function planItem(key: PlanKey): ProposalItem {
  const plan = findPlan(key);
  if (!plan) throw new Error(`Plan desconocido: ${key}`);
  return {
    type: "plan",
    key: plan.key,
    label: plan.label,
    amount: planTotal(plan),
    billing: plan.billing,
  };
}

/** true si la línea del plan no tiene el precio vigente (p. ej. propuesta con precio anterior). */
export function isStalePlanItem(item: ProposalItem): boolean {
  if (item.type !== "plan" || !item.key) return false;
  const plan = findPlan(item.key);
  return plan !== null && item.amount !== planTotal(plan);
}

/** Línea "extra" a partir de un monto NETO (lo que se escribe en el editor). */
export function extraItemFromNet(
  item: Omit<ProposalItem, "amount" | "type">,
  net: number,
): ProposalItem {
  return { ...item, type: "extra", amount: withIva(net) };
}

/** Neto de una línea guardada (su total / 1,19). */
export function itemNet(item: Pick<ProposalItem, "amount">): number {
  return netOfTotal(item.amount);
}

export interface ProposalTotals {
  /** Totales con IVA (lo que se cobra). */
  oneTime: number;
  monthly: number;
  /** Primer pago = único + primer mes, con IVA. Es lo que se guarda en `amount_clp`. */
  firstCharge: number;
  /** Netos (suma del neto de cada línea). */
  oneTimeNet: number;
  monthlyNet: number;
  firstChargeNet: number;
  /** IVA del primer pago = firstCharge − firstChargeNet. */
  firstChargeIva: number;
  /** IVA de cada mes = monthly − monthlyNet. */
  monthlyIva: number;
}

export function computeTotals(items: readonly ProposalItem[]): ProposalTotals {
  const sum = (billing: Billing, value: (i: ProposalItem) => number) =>
    items.filter((i) => i.billing === billing).reduce((acc, i) => acc + value(i), 0);
  const oneTime = sum("one_time", (i) => i.amount);
  const monthly = sum("monthly", (i) => i.amount);
  const oneTimeNet = sum("one_time", itemNet);
  const monthlyNet = sum("monthly", itemNet);
  const firstCharge = oneTime + monthly;
  const firstChargeNet = oneTimeNet + monthlyNet;
  return {
    oneTime,
    monthly,
    firstCharge,
    oneTimeNet,
    monthlyNet,
    firstChargeNet,
    firstChargeIva: firstCharge - firstChargeNet,
    monthlyIva: monthly - monthlyNet,
  };
}

/** Tipo de cobro (`payments.kind`) del primer pago: con parte mensual es "mensual". */
export function chargeKind(totals: Pick<ProposalTotals, "monthly">): "unico" | "mensual" {
  return totals.monthly > 0 ? "mensual" : "unico";
}

/** Errores de validación del editor (vacío = se puede guardar). */
export function validateDraft(input: { title: string; items: readonly ProposalItem[] }): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("Escribe un título.");
  if (input.items.length === 0) errors.push("Agrega el plan o al menos un ítem.");
  if (!ProposalItemsSchema.safeParse(input.items).success) {
    errors.push("Revisa los ítems: cada uno necesita descripción y un monto entero.");
  }
  if (input.items.some((i) => i.amount < 0 && i.type === "plan"))
    errors.push("El plan no puede tener monto negativo.");
  const totals = computeTotals(input.items);
  if (totals.oneTime < 0 || totals.monthly < 0)
    errors.push("Los descuentos no pueden dejar un total negativo.");
  return errors;
}

/** true si la propuesta tiene cobro mensual (por ítems o por el plan). */
export function hasMonthlyBilling(
  planKey: string | null,
  items: readonly Pick<ProposalItem, "billing">[],
): boolean {
  return items.some((i) => i.billing === "monthly") || findPlan(planKey)?.billing === "monthly";
}

/** Condiciones que se muestran (y se aceptan) según el contenido de la propuesta. */
export function proposalConditions(
  planKey: string | null,
  items: readonly ProposalItem[],
): string[] {
  const plan = findPlan(planKey);
  const hasMonthly = hasMonthlyBilling(planKey, items);
  const minMonths = plan?.minMonths ?? 3;
  const conditions: string[] = [];
  if (hasMonthly) {
    conditions.push(
      `Los planes mensuales tienen una permanencia mínima de ${minMonths} meses. Después continúan mes a mes y se cancelan avisando con 30 días de anticipación.`,
    );
  }
  if (plan?.key === "mantencion") {
    conditions.push(
      "El Plan Mantención es para clientes que ya trabajaron con VIBRANDING: incluye 8 piezas al mes, calendario, aprobación en el portal y reporte mensual, sin pauta ni campañas.",
    );
  }
  if (plan?.key === "crecimiento") {
    conditions.push(
      "La inversión en pauta (Meta Ads) no está incluida: la paga directamente el cliente a Meta con su propio medio de pago.",
    );
  }
  conditions.push(
    `Los precios están en pesos chilenos (CLP) y son netos: se suma IVA (${IVA_LABEL}). El total a pagar ya incluye el IVA.`,
  );
  return conditions;
}

// ------------------------------------------------------------------ fechas

const CHILE_TZ = "America/Santiago";

/** Fecha de hoy en Chile + `days`, como YYYY-MM-DD. */
export function chileDatePlusDays(days: number, now: Date = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: CHILE_TZ }).format(now);
  const base = Date.parse(`${today}T12:00:00Z`);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/** Offset de Chile (p. ej. "-03:00") vigente a mediodía de `isoDate`. */
function chileOffset(isoDate: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHILE_TZ,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(`${isoDate}T12:00:00Z`));
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-03:00";
  return raw === "GMT" ? "+00:00" : raw.replace("GMT", "");
}

/** "2026-10-18" → instante ISO de las 23:59:59 de ese día en Chile. */
export function endOfChileDayIso(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error("Fecha inválida");
  return new Date(`${isoDate}T23:59:59${chileOffset(isoDate)}`).toISOString();
}

/** Instante ISO → YYYY-MM-DD en Chile (para el input de fecha). */
export function toChileDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: CHILE_TZ }).format(date);
}

export function formatChileDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: CHILE_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Estado efectivo: enviada/vista con vencimiento pasado se muestra como expirada (igual que la BD). */
export function effectiveStatus(
  status: string,
  expiresAt: string | null,
  now = Date.now(),
): string {
  if (
    (status === "enviada" || status === "vista") &&
    expiresAt &&
    new Date(expiresAt).getTime() <= now
  ) {
    return "expirada";
  }
  return status;
}

export function publicProposalPath(token: string): string {
  return `/p/${token}`;
}
