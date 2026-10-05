/**
 * Material para el hash de visitante único por día. Nunca se guarda la IP:
 * el servidor guarda solo SHA-256(material), y como el día forma parte del
 * material, el hash no permite seguir a una persona entre días (Ley 21.719).
 */
export function visitorHashMaterial(input: {
  ip: string;
  userAgent: string;
  dayKey: string;
  salt: string;
}): string {
  return `${input.salt}|${input.dayKey}|${input.ip}|${input.userAgent}`;
}

/** Id de sesión que genera el navegador (uuid o similar): solo [a-z0-9-], 8–64. */
export const SESSION_ID_PATTERN = /^[a-z0-9-]{8,64}$/i;

/** Id de CTA: "whatsapp:footer", "plan:crecimiento"… */
export const CTA_ID_PATTERN = /^[a-z0-9:_-]{1,40}$/i;
