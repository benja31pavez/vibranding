import { safeHref, safeMapEmbedSrc } from "@/lib/site/safeUrl";

/**
 * Validaciones compartidas por los editores de landing y multienlace.
 * Pensadas para pymes chilenas: WhatsApp móvil +569XXXXXXXX y URLs http(s).
 */

/** Deja sólo dígitos. */
export function digitsOnly(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/**
 * Normaliza un celular chileno a +569XXXXXXXX.
 * Acepta "9 1234 5678", "912345678", "56912345678", "+56 9 1234 5678".
 * Devuelve null si no es un celular chileno reconocible.
 */
export function normalizeChileMobile(raw: string | null | undefined): string | null {
  const d = digitsOnly(raw);
  if (/^9\d{8}$/.test(d)) return `+56${d}`;
  if (/^569\d{8}$/.test(d)) return `+${d}`;
  return null;
}

export function isChileMobile(raw: string | null | undefined): boolean {
  return normalizeChileMobile(raw) !== null;
}

/** "+56912345678" -> "+56 9 1234 5678" para mostrar. */
export function formatChileMobile(e164: string): string {
  const d = digitsOnly(e164);
  if (!/^569\d{8}$/.test(d)) return e164;
  return `+56 9 ${d.slice(3, 7)} ${d.slice(7)}`;
}

export const WHATSAPP_ERROR = "Usa un celular chileno: +56 9 1234 5678";

/** Mensaje de error para un campo de WhatsApp; vacío permitido si `optional`. */
export function whatsappError(raw: string | null | undefined, optional = false): string | null {
  const v = (raw ?? "").trim();
  if (!v) return optional ? null : "Ingresa el número de WhatsApp";
  return isChileMobile(v) ? null : WHATSAPP_ERROR;
}

/** Agrega https:// si el usuario escribió "midominio.cl". */
export function normalizeUrl(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v || v === "https://") return "";
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (/^[\w-]+(\.[\w-]+)+/.test(v)) return `https://${v}`;
  return v;
}

export function isValidHttpUrl(raw: string | null | undefined): boolean {
  const v = safeHref(raw);
  return !!v && /^https?:\/\//i.test(v);
}

/** Error para una URL opcional. Acepta anclas internas (#contacto). */
export function urlError(
  raw: string | null | undefined,
  { allowAnchor = false } = {},
): string | null {
  const v = (raw ?? "").trim();
  if (!v || v === "https://") return null;
  if (allowAnchor && /^#[\w-]+$/.test(v)) return null;
  return isValidHttpUrl(v) ? null : "URL inválida: debe empezar con https://";
}

export function emailError(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : "Email inválido";
}

/** Google Maps: sólo se puede incrustar la URL de "Insertar un mapa" (google.com / google.cl). */
export function mapEmbedError(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  return safeMapEmbedSrc(v)
    ? null
    : "Usa el enlace de Google Maps → Compartir → Insertar un mapa (empieza con https://www.google.com/maps/embed)";
}
