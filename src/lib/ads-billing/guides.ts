/**
 * Guías paso a paso (español de Chile) para que el cliente agregue SU tarjeta
 * en SU cuenta publicitaria. Se muestran en el paso "Publicidad" del onboarding.
 */
import type { AdsPlatform } from "./combined";

export interface AdsGuide {
  platform: AdsPlatform;
  title: string;
  steps: readonly string[];
  link: { href: string; label: string };
  limitTip: string;
}

export const ADS_GUIDES: Readonly<Record<AdsPlatform, AdsGuide>> = {
  google: {
    platform: "google",
    title: "Google Ads",
    steps: [
      "Entra a ads.google.com con la cuenta de Google de tu negocio.",
      "En el menú de la izquierda, abre Facturación y luego Configuración.",
      "Toca Agregar método de pago y registra tu tarjeta (a tu nombre o al de tu empresa).",
      "Revisa que el país sea Chile y la moneda pesos chilenos (CLP), y guarda.",
    ],
    link: {
      href: "https://ads.google.com/aw/billing/settings",
      label: "Abrir Facturación de Google Ads",
    },
    limitTip:
      "El monto mensual lo acordamos con Benja y lo dejamos fijo en el presupuesto de tus campañas.",
  },
  meta: {
    platform: "meta",
    title: "Meta (Facebook e Instagram)",
    steps: [
      "Entra a business.facebook.com/billing_hub con tu usuario de Facebook.",
      "Elige la cuenta publicitaria de tu negocio.",
      "En Configuración de pagos, toca Agregar método de pago y registra tu tarjeta.",
      "En Límite de gasto de la cuenta, escribe el monto mensual que acordaste con Benja.",
    ],
    link: {
      href: "https://business.facebook.com/billing_hub",
      label: "Abrir Configuración de pagos de Meta",
    },
    limitTip: "Con el límite de gasto, Meta nunca cobrará más de ese monto a tu tarjeta.",
  },
};

/** Opciones del paso: dónde va a publicitar el cliente. */
export const ADS_CHOICES = [
  { value: "google", label: "Google", hint: "Búsquedas y Maps" },
  { value: "meta", label: "Meta", hint: "Facebook e Instagram" },
  { value: "ambos", label: "Ambos", hint: "Google y Meta" },
  { value: "ninguno", label: "Ninguno por ahora", hint: "Lo vemos más adelante" },
] as const;
export type AdsChoice = (typeof ADS_CHOICES)[number]["value"];

/** Opción elegida → plataformas. "" (sin responder) → null. */
export function platformsForChoice(choice: AdsChoice | ""): AdsPlatform[] | null {
  switch (choice) {
    case "google":
      return ["google"];
    case "meta":
      return ["meta"];
    case "ambos":
      return ["google", "meta"];
    case "ninguno":
      return [];
    default:
      return null;
  }
}
