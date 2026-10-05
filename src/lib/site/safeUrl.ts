/**
 * Allowlist de URLs para todo lo que viene de datos del cliente y termina en
 * un href, src o JSON-LD. Cualquier otro esquema (javascript:, data:, vbscript:,
 * blob:, rutas relativas raras…) devuelve null y el enlace no se renderiza.
 */

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/** Caracteres de control/espacios que algunos navegadores ignoran dentro del esquema. */
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F-\\u009F\\u2028\\u2029]", "g");

function parse(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/**
 * Href seguro: http(s), mailto:, tel: o una ancla interna (#seccion).
 * wa.me se acepta como cualquier https. Devuelve null si no es seguro.
 */
export function safeHref(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(CONTROL_CHARS, "").trim();
  if (!v) return null;
  if (/^#[\w-]+$/.test(v)) return v;
  const u = parse(v);
  if (!u || !SAFE_LINK_PROTOCOLS.has(u.protocol)) return null;
  if ((u.protocol === "http:" || u.protocol === "https:") && !u.hostname.includes(".")) return null;
  if (u.protocol === "mailto:" && !/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/i.test(v)) return null;
  if (u.protocol === "tel:" && !/^tel:\+?[\d\s().-]{6,20}$/i.test(v)) return null;
  return u.protocol === "http:" || u.protocol === "https:" ? u.href : v;
}

/** Sólo http(s) absolutas (para JSON-LD url/sameAs y botones externos). */
export function safeWebUrl(raw: string | null | undefined): string | null {
  const v = safeHref(raw);
  return v && /^https?:\/\//i.test(v) ? v : null;
}

/** src de imagen/video: sólo https. */
export function safeImageSrc(raw: string | null | undefined): string | null {
  const v = safeHref(raw);
  return v && v.startsWith("https://") ? v : null;
}

/** ¿El enlace abre en otra pestaña? (sólo destinos web). */
export function isExternalHref(href: string | null): boolean {
  return !!href && /^https?:\/\//i.test(href);
}

const MAP_ORIGINS = new Set(["https://www.google.com", "https://www.google.cl"]);

/** URL de Google Maps "Insertar un mapa"; cualquier otra cosa → null (no se renderiza el iframe). */
export function safeMapEmbedSrc(raw: string | null | undefined): string | null {
  const v = safeImageSrc(raw);
  const u = v ? parse(v) : null;
  if (!u || !MAP_ORIGINS.has(u.origin) || !u.pathname.startsWith("/maps/embed")) return null;
  return u.href;
}
