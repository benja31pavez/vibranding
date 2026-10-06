/**
 * Adicionales en Facturación (módulo puro, sin red: `npm run check:membership`).
 *
 *  - Cada cobro guarda su desglose en `payments.items` (mismo criterio que los
 *    ítems de propuestas: `amount` = total de la línea CON IVA, lo que se cobra).
 *  - El total de un cobro es la suma de sus líneas; lo calcula SIEMPRE el
 *    servidor con estas funciones (el navegador solo dice qué plan o adicional).
 *  - Chatbot: pago único de configuración y, desde ahí, su mantención mensual se
 *    suma a cada pago del plan mensual mientras esté activo.
 */
import {
  addonMonthlyTotal,
  addonSetupTotal,
  findAddon,
  type Addon,
  type AddonKey,
} from "@/lib/pricing/addons";
import { findPlan, planTotal, type Billing, type Plan } from "@/lib/pricing/plans";
import { isActiveMembership, type Membership } from "./membership";

export interface PaymentItem {
  type: "plan" | "addon";
  key: string;
  label: string;
  /** Neto de la línea (sin IVA). */
  net: number;
  /** Total de la línea con IVA (lo que se cobra). */
  amount: number;
  billing: Billing;
}

function planLine(plan: Plan): PaymentItem {
  return {
    type: "plan",
    key: plan.key,
    label: plan.label,
    net: plan.netPrice,
    amount: planTotal(plan),
    billing: plan.billing,
  };
}

function monthlyLine(addon: Addon): PaymentItem {
  return {
    type: "addon",
    key: addon.key,
    label: `${addon.label} · mensualidad`,
    net: addon.monthlyNet,
    amount: addonMonthlyTotal(addon),
    billing: "monthly",
  };
}

/**
 * Líneas del pago de un plan: el plan y, si es mensual, la mantención de cada
 * adicional activo. Marca + Web (pago único) nunca lleva mantenciones.
 */
export function planChargeItems(plan: Plan, activeAddons: readonly AddonKey[] = []): PaymentItem[] {
  if (plan.billing !== "monthly") return [planLine(plan)];
  const monthly = activeAddons
    .map((key) => findAddon(key))
    .filter((a): a is Addon => Boolean(a && a.monthlyNet > 0))
    .map(monthlyLine);
  return [planLine(plan), ...monthly];
}

/** Línea del pago único de un adicional (configuración del chatbot, landing extra). */
export function addonSetupItems(addon: Addon): PaymentItem[] {
  return [
    {
      type: "addon",
      key: addon.key,
      label: `${addon.label} · ${addon.setupLabel.toLowerCase()}`,
      net: addon.setupNet,
      amount: addonSetupTotal(addon),
      billing: "one_time",
    },
  ];
}

export interface ItemsTotal {
  net: number;
  iva: number;
  total: number;
}

/** Total del cobro = suma de las líneas (cada una con su IVA, igual que propuestas). */
export function itemsTotal(items: readonly PaymentItem[]): ItemsTotal {
  const net = items.reduce((acc, i) => acc + i.net, 0);
  const total = items.reduce((acc, i) => acc + i.amount, 0);
  return { net, iva: total - net, total };
}

/** Lee `payments.items` de la BD; si el formato no calza devuelve [] (nunca rompe la vista). */
export function parsePaymentItems(value: unknown): PaymentItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Record<string, unknown>;
    const ok =
      (r.type === "plan" || r.type === "addon") &&
      typeof r.key === "string" &&
      typeof r.label === "string" &&
      Number.isInteger(r.net) &&
      Number.isInteger(r.amount) &&
      (r.billing === "monthly" || r.billing === "one_time");
    return ok ? [r as unknown as PaymentItem] : [];
  });
}

/** true si la membresía tiene un plan MENSUAL vigente (Activo o Por renovar). */
export function hasMonthlyPlan(m: Pick<Membership, "state" | "planKey">): boolean {
  return isActiveMembership(m) && findPlan(m.planKey)?.billing === "monthly";
}

/** Motivo (para el usuario) por el que no puede contratar `addon` hoy; null si puede. */
export function addonBlockedReason(
  m: Pick<Membership, "state" | "planKey" | "activeAddons">,
  addon: Addon,
): string | null {
  if (addon.requiresMonthlyPlan && !hasMonthlyPlan(m)) {
    return "El chatbot se contrata con un plan mensual vigente. Contrata o renueva tu plan primero.";
  }
  if (addon.monthlyNet > 0 && m.activeAddons.includes(addon.key)) {
    return `Tu ${addon.label} ya está activo.`;
  }
  return null;
}
