/**
 * Utilidades compartidas por las páginas públicas por token (/p/$token
 * propuestas, /r/$token reportes). Solo se usan dentro de handlers de server
 * functions: el compilador las elimina del bundle del navegador.
 */
import { setResponseHeaders } from "@tanstack/react-start/server";

const MINUTE = 60 * 1000;

export const RATE_LIMITED =
  "Demasiados intentos desde tu conexión. Espera un rato y vuelve a intentarlo.";

/** Respuestas con datos privados por token: nunca en caché, sin Referer ni indexación. */
export function privateHeaders() {
  setResponseHeaders(
    new Headers({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    }),
  );
}

let viewLimiter: import("@/lib/security/ipRateLimit.server").RateLimiter | undefined;

/**
 * Límite de lecturas públicas por token: 60 cargas / 10 min por IP (sin IP,
 * bucket por token). `scope` separa los contadores de cada tipo de página.
 * Best effort en memoria (ver ipRateLimit.server.ts).
 */
export async function allowPublicView(scope: string, token: string): Promise<boolean> {
  const { createRateLimiter, limitKey } = await import("@/lib/security/ipRateLimit.server");
  viewLimiter ??= createRateLimiter(60, 10 * MINUTE);
  return viewLimiter.allow(limitKey(scope, token));
}
