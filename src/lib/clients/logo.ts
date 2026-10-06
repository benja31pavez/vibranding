// Reglas puras del logo del cliente (sin I/O): las usa logo.server.ts y el
// script scripts/check-client-logo.mjs.

/** Formatos aceptados (se detectan por los bytes, no por la extensión ni el header). */
export const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type LogoType = (typeof LOGO_TYPES)[number];

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
/** Un logo de Instagram con más días que esto se vuelve a pedir en el cron semanal. */
export const LOGO_REFRESH_DAYS = 7;
/** Tiempo máximo para descargar la foto de perfil desde el CDN de Meta. */
export const LOGO_DOWNLOAD_TIMEOUT_MS = 8_000;
export const LOGO_BUCKET = "client-media";

export type LogoSource = "instagram" | "manual";

export const LOGO_ERRORS = {
  notBusiness: "La cuenta de Instagram no es de empresa o creador",
  noHandle: "El cliente no tiene un usuario de Instagram en su ficha.",
  noViewer:
    "Para leer perfiles no conectados se necesita al menos una cuenta de Instagram Business conectada en la agencia.",
  noPicture: "La cuenta de Instagram no tiene foto de perfil.",
  tooBig: "La imagen pesa más de 2 MB.",
  empty: "La imagen está vacía.",
  badType: "Formato no válido: usa JPG, PNG o WebP.",
  badHost: "La foto de perfil no viene de Instagram.",
  timeout: "Instagram tardó demasiado en entregar la foto. Intenta más tarde.",
  manualLocked:
    "Este cliente tiene un logo subido a mano. Usa “Volver a usar Instagram” para reemplazarlo.",
  missingColumns: "Falta aplicar la migración de logos de clientes.",
} as const;

const EXT: Record<LogoType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isLogoSource(v: unknown): v is LogoSource {
  return v === "instagram" || v === "manual";
}

/** Tipo real según la firma de los primeros bytes (JPEG, PNG o WebP). */
export function detectImageType(bytes: Uint8Array): LogoType | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return "image/jpeg";
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((b, i) => at(i) === b)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

type LogoCheck = { ok: true; type: LogoType } | { ok: false; error: string };

/**
 * Valida tamaño y formato. `declaredType` (header o el del archivo) es
 * opcional; si viene y no coincide con los bytes, se rechaza.
 */
export function validateLogoBytes(bytes: Uint8Array, declaredType?: string | null): LogoCheck {
  if (bytes.length === 0) return { ok: false, error: LOGO_ERRORS.empty };
  if (bytes.length > LOGO_MAX_BYTES) return { ok: false, error: LOGO_ERRORS.tooBig };
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: LOGO_ERRORS.badType };
  const declared = declaredType?.split(";")[0]?.trim().toLowerCase();
  if (declared && declared !== type && !(declared === "image/jpg" && type === "image/jpeg")) {
    return { ok: false, error: LOGO_ERRORS.badType };
  }
  return { ok: true, type };
}

/** Rechaza antes de descargar si el servidor ya anuncia un tamaño mayor al límite. */
export function exceedsDeclaredLength(contentLength: string | null): boolean {
  if (!contentLength) return false;
  const n = Number(contentLength);
  return Number.isFinite(n) && n > LOGO_MAX_BYTES;
}

/** Solo se descarga desde el CDN de Meta/Instagram por HTTPS (evita SSRF). */
export function isAllowedPictureUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ["fbcdn.net", "cdninstagram.com"].some((d) => host === d || host.endsWith(`.${d}`));
}

/** De dónde viene la orden de actualizar el logo desde Instagram. */
export type InstagramLogoTrigger = "auto" | "button" | "reset";

/**
 * Un logo manual nunca se pisa automáticamente (cron, cambio de @) ni con
 * "Actualizar"; solo "Volver a usar Instagram" (reset) lo reemplaza.
 */
export function canUseInstagramLogo(
  current: LogoSource | null,
  trigger: InstagramLogoTrigger,
): boolean {
  return current !== "manual" || trigger === "reset";
}

/** El cron vuelve a pedir el logo si nunca se obtuvo o tiene más de 7 días. */
export function isLogoStale(updatedAt: string | null, now: Date): boolean {
  if (!updatedAt) return true;
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t >= LOGO_REFRESH_DAYS * 24 * 60 * 60 * 1000;
}

/** Ruta en el bucket: logos/<client_id>/<hash>.<ext> (contenido direccionable). */
export function logoPath(clientId: string, hash: string, type: LogoType): string {
  return `logos/${clientId}/${hash}.${EXT[type]}`;
}
