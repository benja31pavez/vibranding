/**
 * Hash de IP + límite de intentos por IP para endpoints públicos.
 * Mismo patrón que la reserva pública (src/lib/bookings/bookings.functions.ts)
 * y el formulario de contacto de landings: IP de cf-connecting-ip /
 * x-real-ip / x-forwarded-for, hash SHA-256 con la sal SUPABASE_PROJECT_SALT.
 *
 * El límite vive en memoria de la instancia del Worker: es una primera barrera
 * (best effort), no una garantía global. La BD valida el resto.
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

/** Hash salado de la IP (nunca se guarda la IP en claro). */
export async function clientIpHash(req?: Request): Promise<string | null> {
  const ip = clientIp(req);
  if (!ip) return null;
  const { createHash } = await import("crypto");
  return createHash("sha256")
    .update(`${ip}:${process.env["SUPABASE_PROJECT_SALT"] ?? "landing"}`)
    .digest("hex");
}

export interface IpRateLimiter {
  /** Registra un intento; false si la IP ya superó el límite de la ventana. */
  allow(ipHash: string | null, now?: number): boolean;
}

const MAX_TRACKED_KEYS = 5000;

export function createIpRateLimiter(limit: number, windowMs: number): IpRateLimiter {
  const attempts = new Map<string, number[]>();
  return {
    allow(ipHash, now = Date.now()) {
      if (!ipHash) return true;
      const since = now - windowMs;
      const recent = (attempts.get(ipHash) ?? []).filter((t) => t > since);
      if (recent.length >= limit) {
        attempts.set(ipHash, recent);
        return false;
      }
      attempts.set(ipHash, [...recent, now]);
      if (attempts.size > MAX_TRACKED_KEYS) {
        for (const [key, times] of attempts) {
          if (!times.some((t) => t > since)) attempts.delete(key);
        }
      }
      return true;
    },
  };
}
