// Configuración de Google Ads leída de variables de entorno del Worker.
// Nunca se envían valores al navegador: solo qué variables faltan.
import { normalizeCustomerId } from "@/lib/google-ads/gaql";

/**
 * Versión de la API REST. v25 (julio 2026) se mantiene hasta agosto de 2027.
 * https://developers.google.com/google-ads/api/docs/sunset-dates
 */
export const GOOGLE_ADS_API_VERSION = "v25";
export const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleAdsConfig = {
  clientId: string;
  clientSecret: string;
  /** Opcional desde el 9-sep-2026: la API lo ignora (el acceso va por el proyecto de Cloud). */
  developerToken: string | null;
  /** MCC por defecto para login-customer-id (opcional). */
  loginCustomerId: string | null;
};

/** Variables obligatorias que faltan, con explicación en lenguaje simple. */
export type MissingVar = { name: string; why: string };

function env(name: string): string | null {
  const v = process.env[name]?.trim();
  return v ? v : null;
}

export function missingGoogleAdsVars(): MissingVar[] {
  const missing: MissingVar[] = [];
  if (!env("GOOGLE_ADS_CLIENT_ID")) {
    missing.push({
      name: "GOOGLE_ADS_CLIENT_ID",
      why: "Identificador del cliente OAuth (Google Cloud → APIs y servicios → Credenciales).",
    });
  }
  if (!env("GOOGLE_ADS_CLIENT_SECRET")) {
    missing.push({
      name: "GOOGLE_ADS_CLIENT_SECRET",
      why: "Clave secreta de ese mismo cliente OAuth.",
    });
  }
  if (!env("PUBLIC_SITE_URL")) {
    missing.push({
      name: "PUBLIC_SITE_URL",
      why: "Dirección pública de la plataforma (ej. https://vibranding.pro), para que Google sepa a dónde volver.",
    });
  }
  return missing;
}

/** Config completa o null si falta algo obligatorio. */
export function getGoogleAdsConfig(): GoogleAdsConfig | null {
  const clientId = env("GOOGLE_ADS_CLIENT_ID");
  const clientSecret = env("GOOGLE_ADS_CLIENT_SECRET");
  if (!clientId || !clientSecret || !env("PUBLIC_SITE_URL")) return null;
  return {
    clientId,
    clientSecret,
    developerToken: env("GOOGLE_ADS_DEVELOPER_TOKEN"),
    loginCustomerId: normalizeCustomerId(env("GOOGLE_ADS_LOGIN_CUSTOMER_ID")),
  };
}

export function requireGoogleAdsConfig(): GoogleAdsConfig {
  const cfg = getGoogleAdsConfig();
  if (!cfg) {
    throw new Error(
      `Google Ads no está configurado. Faltan: ${missingGoogleAdsVars()
        .map((m) => m.name)
        .join(", ")}`,
    );
  }
  return cfg;
}

export function googleRedirectUri(): string {
  const origin = (env("PUBLIC_SITE_URL") ?? "").replace(/\/$/, "");
  if (!origin) throw new Error("PUBLIC_SITE_URL no está configurada");
  return `${origin}/api/public/google/oauth/callback`;
}
