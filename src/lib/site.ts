/**
 * Public site constants for vibranding.pro (agency marketing site).
 * Single source of truth for contact data and legal identity.
 */

export const SITE_URL = "https://vibranding.pro";

/** Shared JSON-LD @id for the agency (Organization + ProfessionalService). */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/** WhatsApp number in international format, digits only (Chile +56). */
export const WHATSAPP_NUMBER = "56989294014";
export const WHATSAPP_DISPLAY = "+56 9 8929 4014";
export const WHATSAPP_E164 = `+${WHATSAPP_NUMBER}`;

/**
 * Link para dejar una reseña de Google de Vibranding (Google Business Profile →
 * "Pedir reseñas"). Se configura con VITE_GOOGLE_REVIEW_URL; vacío = no configurado.
 * `?.` porque los scripts de check corren fuera de Vite (sin import.meta.env).
 */
export const GOOGLE_REVIEW_URL: string = String(
  import.meta.env?.VITE_GOOGLE_REVIEW_URL ?? "",
).trim();

export const LEGAL_NAME = "VIBRANDING SpA";
export const LEGAL_RUT = "78.505.344-3";

export const DEFAULT_WHATSAPP_MESSAGE =
  "Hola Vibranding, tengo una pyme y quiero cotizar. Mi negocio es: ";

/** Builds a wa.me link with an optional pre-filled message. */
export function whatsappUrl(message: string = DEFAULT_WHATSAPP_MESSAGE): string {
  const text = message.trim() ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${WHATSAPP_NUMBER}${text}`;
}

/** Formats an integer CLP amount as "$149.990". */
export function formatClp(amount: number): string {
  // Manual grouping keeps server and browser output identical (no ICU differences).
  return `$${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** Portfolio entries that are placeholders and must never be shown publicly. */
const PLACEHOLDER_NAME = /^(marca\s*\d+|placeholder|test|prueba|cliente\s*\d+|lorem.*)$/i;

export function isPlaceholderName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  return n.length === 0 || PLACEHOLDER_NAME.test(n);
}
