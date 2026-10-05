/**
 * Cabeceras de seguridad que el Worker (src/server.ts) agrega a TODA respuesta
 * que pasa por TanStack Start (páginas SSR, server functions y rutas /api).
 *
 * - X-Content-Type-Options: nosniff
 * - Referrer-Policy: strict-origin-when-cross-origin (las rutas privadas por
 *   token lo endurecen a no-referrer; si una respuesta ya trae la cabecera se respeta)
 * - Anti-clickjacking: X-Frame-Options: DENY + CSP `frame-ancestors 'none'`.
 *
 * Ninguna ruta propia se muestra dentro de un iframe de la app: la vista previa
 * en vivo de landings/multilink (DevicePreview) usa un iframe sin `src`
 * (about:blank, no pasa por el Worker) y la vista previa del portal es una ruta
 * normal (/clients/$clientId/portal-preview). Por eso no hay rutas con
 * `frame-ancestors 'self'`; si alguna vez se embebe una ruta propia, agregar su
 * prefijo a SAME_ORIGIN_FRAMED_PATHS.
 *
 * Excepción: los hosts de vista previa del editor de Lovable (*.lovableproject.com,
 * id-preview--<id>.lovable.app, …) se muestran dentro de lovable.dev; ahí se
 * permite ese ancestro para no romper el editor. El sitio publicado
 * (vibranding.pro, vibranding.lovable.app) queda en DENY.
 *
 * No se agrega una CSP completa (script-src, etc.): rompería scripts de terceros.
 */

/** Prefijos de rutas propias que se embeben en iframes del mismo origen. Hoy ninguna. */
const SAME_ORIGIN_FRAMED_PATHS: readonly string[] = [];

/** Zonas donde todo host es vista previa del editor de Lovable. */
const PREVIEW_ONLY_ZONES = ["lovableproject.com", "lovableproject-dev.com", "gpt-eng.com", "gptengineer.run"];
/** En lovable.app solo son vista previa los hosts id-preview--, preview--, project-- o <uuid>-. */
const LOVABLE_APP_PREVIEW_LABEL =
  /^(?:id-preview(?:-[a-z0-9]+)?--|preview--|project--|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-|$))/i;
const LOVABLE_EDITOR_ANCESTORS =
  "'self' https://lovable.dev https://*.lovable.dev https://gptengineer.app https://*.gptengineer.app";

const BASE_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export function isLovablePreviewHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (PREVIEW_ONLY_ZONES.some((zone) => host === zone || host.endsWith(`.${zone}`))) return true;
  return host.endsWith(".lovable.app") && LOVABLE_APP_PREVIEW_LABEL.test(host.split(".")[0] ?? "");
}

function isSameOriginFramed(pathname: string): boolean {
  return SAME_ORIGIN_FRAMED_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Cabeceras de seguridad para una URL (función pura, ver scripts/check-security-headers.mjs). */
export function securityHeadersFor(url: URL): Record<string, string> {
  if (isLovablePreviewHost(url.hostname)) {
    return { ...BASE_HEADERS, "Content-Security-Policy": `frame-ancestors ${LOVABLE_EDITOR_ANCESTORS}` };
  }
  if (isSameOriginFramed(url.pathname)) {
    return {
      ...BASE_HEADERS,
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    };
  }
  return {
    ...BASE_HEADERS,
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "frame-ancestors 'none'",
  };
}

/**
 * Agrega las cabeceras a `headers` sin pisar las que la respuesta ya trae
 * (p. ej. Referrer-Policy: no-referrer de las páginas por token). Si ya hay una
 * CSP, se le suma la directiva frame-ancestors cuando no la tenga.
 */
export function mergeSecurityHeaders(headers: Headers, url: URL): Headers {
  const merged = new Headers(headers);
  for (const [name, value] of Object.entries(securityHeadersFor(url))) {
    const current = merged.get(name);
    if (!current) {
      merged.set(name, value);
    } else if (name === "Content-Security-Policy" && !/frame-ancestors/i.test(current)) {
      merged.set(name, `${current}; ${value}`);
    }
  }
  return merged;
}
