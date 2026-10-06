/**
 * Servicios adicionales de VIBRANDING SpA (decisión de Benja, 2026-10-06).
 *
 * Precio FIJO, igual que los planes: NETO en CLP + IVA 19 % (ver `./iva.ts`).
 * Nunca a medida ni "a cotizar" (lo revisa `npm run check:iva`).
 *
 *  - Chatbot WhatsApp: pago único de configuración + mantención mensual. La
 *    mantención se cobra junto con cada pago del plan mensual mientras el
 *    adicional esté activo. Solo se contrata con un plan mensual vigente.
 *  - Landing extra: pago único.
 *
 * El mismo precio vive en SQL (`public.addon_setup_net_price` y
 * `public.addon_monthly_net_price`, migración 20261012002600): si cambias un
 * precio aquí, cámbialo también allá (`npm run check:membership` los compara).
 */
import { withIva } from "./iva";
import { formatMoney } from "./plans";

export type AddonKey = "chatbot" | "landing";

export interface Addon {
  key: AddonKey;
  label: string;
  description: string;
  /** Pago único NETO (configuración o entrega). */
  setupNet: number;
  /** Mantención mensual NETA; 0 si no tiene. */
  monthlyNet: number;
  /** Etiqueta del pago único en desgloses ("Configuración", "Pago único"). */
  setupLabel: string;
  /** Solo se contrata con un plan mensual vigente. */
  requiresMonthlyPlan: boolean;
}

export const ADDONS: readonly Addon[] = [
  {
    key: "chatbot",
    label: "Chatbot WhatsApp",
    description:
      "Chatbot en tu WhatsApp que responde preguntas frecuentes y te pasa los contactos.",
    setupNet: 99_990,
    monthlyNet: 29_990,
    setupLabel: "Configuración",
    requiresMonthlyPlan: true,
  },
  {
    key: "landing",
    label: "Landing extra",
    description: "Página adicional para una campaña, producto o servicio específico.",
    setupNet: 59_990,
    monthlyNet: 0,
    setupLabel: "Pago único",
    requiresMonthlyPlan: false,
  },
];

export const ADDON_KEYS = ADDONS.map((a) => a.key) as [AddonKey, ...AddonKey[]];

export function isAddonKey(value: unknown): value is AddonKey {
  return typeof value === "string" && (ADDON_KEYS as readonly string[]).includes(value);
}

export function findAddon(key: string | null | undefined): Addon | null {
  return ADDONS.find((a) => a.key === key) ?? null;
}

/** Pago único con IVA. */
export function addonSetupTotal(addon: Pick<Addon, "setupNet">): number {
  return withIva(addon.setupNet);
}

/** Mantención mensual con IVA (0 si no tiene). */
export function addonMonthlyTotal(addon: Pick<Addon, "monthlyNet">): number {
  return addon.monthlyNet > 0 ? withIva(addon.monthlyNet) : 0;
}

/** "$99.990 + IVA de configuración y $29.990 + IVA al mes" / "$59.990 + IVA pago único" (textos). */
export function addonPriceText(addon: Pick<Addon, "setupNet" | "monthlyNet">): string {
  const setup = formatMoney(addon.setupNet);
  return addon.monthlyNet > 0
    ? `${setup} + IVA de configuración y ${formatMoney(addon.monthlyNet)} + IVA al mes`
    : `${setup} + IVA pago único`;
}

function requireAddon(key: AddonKey): Addon {
  const addon = findAddon(key);
  if (!addon) throw new Error(`Adicional desconocido: ${key}`);
  return addon;
}

export const CHATBOT_ADDON = requireAddon("chatbot");
export const LANDING_ADDON = requireAddon("landing");
/** Precio del chatbot para textos (propuestas, páginas públicas). */
export const CHATBOT_PRICE = addonPriceText(CHATBOT_ADDON);
