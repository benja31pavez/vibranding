/**
 * Atribución de visitas: primer contacto de la sesión (UTM, dominio de origen,
 * clics de anuncios), tipo de dispositivo y etiqueta de fuente legible.
 * Funciones puras, sin acceso a window: el cliente les pasa los valores.
 */

export type DeviceType = "mobile" | "tablet" | "desktop";

/** Primer contacto de la sesión. Se calcula una vez y viaja con cada evento. */
export interface FirstTouch {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** Dominio externo de origen (sin www.); null si es directo o navegación interna. */
  referrerDomain: string | null;
  hasGclid: boolean;
  hasFbclid: boolean;
  /** Ruta de entrada sin query string (la query puede traer datos personales). */
  landingPath: string;
}

const UTM_MAX = 120;
const PATH_MAX = 200;

/** Páginas públicas del sitio de la agencia que cuentan como visita del landing. */
const PUBLIC_SITE_PATHS = new Set([
  "/",
  "/diagnostico",
  "/faq",
  "/landing",
  "/terms",
  "/terminos",
  "/privacy",
  "/privacidad",
  "/cookies",
  "/pagina-web-para-pymes",
  "/agencia-marketing-digital-santiago",
  "/publicidad-meta-ads",
  "/google-ads-pymes",
  "/chatbot-whatsapp",
]);

/** Ruta sin query/hash, sin barra final y acotada. */
export function cleanPath(pathname: string): string {
  const bare = pathname.split(/[?#]/)[0] || "/";
  const trimmed = bare.length > 1 ? bare.replace(/\/+$/, "") : bare;
  return (trimmed || "/").slice(0, PATH_MAX);
}

export function isPublicSitePath(pathname: string): boolean {
  return PUBLIC_SITE_PATHS.has(cleanPath(pathname));
}

function utmValue(params: URLSearchParams, key: string): string | null {
  const v = params.get(key)?.trim().toLowerCase();
  return v ? v.slice(0, UTM_MAX) : null;
}

/** Dominio del referrer sin "www."; null si falta, es inválido o es el propio sitio. */
export function referrerDomain(
  referrer: string | null | undefined,
  ownHost: string,
): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return null;
    const own = ownHost.toLowerCase().replace(/^www\./, "");
    return host === own ? null : host.slice(0, UTM_MAX);
  } catch {
    return null;
  }
}

export function firstTouchFrom(input: {
  search: string;
  referrer: string | null;
  ownHost: string;
  pathname: string;
}): FirstTouch {
  const params = new URLSearchParams(input.search);
  return {
    utmSource: utmValue(params, "utm_source"),
    utmMedium: utmValue(params, "utm_medium"),
    utmCampaign: utmValue(params, "utm_campaign"),
    referrerDomain: referrerDomain(input.referrer, input.ownHost),
    hasGclid: params.has("gclid") || params.has("gbraid") || params.has("wbraid"),
    hasFbclid: params.has("fbclid"),
    landingPath: cleanPath(input.pathname),
  };
}

export function deviceType(userAgent: string | null | undefined): DeviceType {
  const ua = userAgent ?? "";
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/i.test(ua)) return "mobile";
  return "desktop";
}

const KNOWN_REFERRERS: ReadonlyArray<[RegExp, string]> = [
  [/(^|\.)google\.[a-z.]+$/, "Google (orgánico)"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\.com$/, "Yahoo"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X / Twitter"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "WhatsApp"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, "ChatGPT"],
  [/(^|\.)perplexity\.ai$/, "Perplexity"],
];

/** Campos de atribución de una fila de landing_events (columnas opcionales). */
export interface AttributionFields {
  utm_source?: string | null;
  utm_medium?: string | null;
  referrer?: string | null;
  referrer_domain?: string | null;
  has_gclid?: boolean | null;
  has_fbclid?: boolean | null;
}

export const DIRECT_SOURCE = "Directo";

/**
 * Fuente legible. Prioridad: clic de Google Ads (gclid) → UTM → clic desde
 * Meta (fbclid) → dominio de origen → Directo. Las filas antiguas sin
 * referrer_domain usan el referrer completo guardado.
 */
export function sourceLabel(row: AttributionFields, ownHost = "vibranding.pro"): string {
  if (row.has_gclid) return "Google Ads";
  const utm = row.utm_source?.trim().toLowerCase();
  if (utm) {
    const medium = row.utm_medium?.trim().toLowerCase();
    return medium ? `${utm} / ${medium}` : utm;
  }
  if (row.has_fbclid) return "Meta (Facebook / Instagram)";
  const domain = row.referrer_domain?.trim().toLowerCase() || referrerDomain(row.referrer, ownHost);
  if (!domain) return DIRECT_SOURCE;
  const known = KNOWN_REFERRERS.find(([re]) => re.test(domain));
  return known ? known[1] : domain;
}
