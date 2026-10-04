/**
 * IP del cliente, hash de IP y límites de intentos en memoria para endpoints
 * públicos. Mismo origen de IP que la reserva pública y el contacto de landings
 * (cf-connecting-ip / x-real-ip / x-forwarded-for).
 *
 * Los límites viven en memoria de la instancia del Worker: son una primera
 * barrera (best effort), no una garantía global. Para un límite global usar
 * una regla de Rate Limiting de Cloudflare (ver PR de propuestas).
 */
import { getRequest } from "@tanstack/react-start/server";

/** IP del cliente según las cabeceras del proxy (Cloudflare primero). */
export function clientIp(req: Request | undefined = getRequest()): string | null {
  return (
    req?.headers.get("cf-connecting-ip") ??
    req?.headers.get("x-real-ip") ??
    req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export class MissingSaltError extends Error {
  constructor() {
    super("Falta IP_HASH_SALT: no se puede calcular el hash de IP");
    this.name = "MissingSaltError";
  }
}

/**
 * Hash salado de la IP para GUARDAR (nunca se guarda la IP en claro).
 * Sin IP_HASH_SALT (secret de Lovable Cloud; el prefijo SUPABASE_ está reservado) falla: un hash sin sal secreta es reversible
 * probando IPs. (El contacto de landings y las reservas mantienen su fallback
 * histórico; no se tocaron aquí.)
 */
export async function clientIpHash(req?: Request): Promise<string | null> {
  const ip = clientIp(req);
  if (!ip) return null;
  const salt = (process.env["IP_HASH_SALT"] ?? process.env["SUPABASE_PROJECT_SALT"])?.trim();
  if (!salt) throw new MissingSaltError();
  const { createHash } = await import("crypto");
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}

export interface RateLimiter {
  /** Registra un intento para `key`; false si ya superó el límite de la ventana. */
  allow(key: string, now?: number): boolean;
}

const MAX_TRACKED_KEYS = 5000;

/** Límite deslizante en memoria: `limit` intentos por `windowMs` y por clave. */
export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const attempts = new Map<string, number[]>();
  return {
    allow(key, now = Date.now()) {
      const since = now - windowMs;
      const recent = (attempts.get(key) ?? []).filter((t) => t > since);
      if (recent.length >= limit) {
        attempts.set(key, recent);
        return false;
      }
      attempts.set(key, [...recent, now]);
      if (attempts.size > MAX_TRACKED_KEYS) {
        for (const [k, times] of attempts) {
          if (!times.some((t) => t > since)) attempts.delete(k);
        }
      }
      return true;
    },
  };
}

/**
 * Clave de límite: la IP (en memoria, nunca se guarda) si existe; si no, un
 * bucket por recurso (p. ej. el token), para que la falta de IP no anule el límite.
 */
export function limitKey(scope: string, fallback: string, req?: Request): string {
  const ip = clientIp(req);
  return ip ? `${scope}:ip:${ip}` : `${scope}:res:${fallback}`;
}
