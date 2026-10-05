import { createServerFn } from "@tanstack/react-start";
import { DiagnosticoInput, type DiagnosticoResult } from "./diagnostico.schema";

const MAX_PER_IP = 5;
const WINDOW_MS = 60 * 60 * 1000;

/** Instancia por Worker (best effort, ver ipRateLimit.server.ts). */
let limiter: import("@/lib/security/ipRateLimit.server").RateLimiter | null = null;

/** Clave del límite: hash salado de la IP (IP_HASH_SALT); sin sal, la IP solo en memoria. */
async function rateKey(): Promise<string> {
  const { clientIpHash, limitKey, MissingSaltError } = await import("@/lib/security/ipRateLimit.server");
  try {
    const hash = await clientIpHash();
    if (hash) return `diagnostico:h:${hash}`;
  } catch (e) {
    if (!(e instanceof MissingSaltError)) throw e;
    console.warn("[diagnostico] falta IP_HASH_SALT: el límite usa la IP solo en memoria");
  }
  return limitKey("diagnostico", "sin-ip");
}

/**
 * Formulario público "Diagnóstico gratis": crea (o anota) un prospecto en la
 * org del administrador de la plataforma y avisa por correo si hay Resend.
 * Honeypot → responde ok sin guardar nada. Límite: 5 envíos por hora por IP.
 */
export const submitDiagnostico = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const parsed = DiagnosticoInput.safeParse(input);
    return parsed.success ? parsed.data : null;
  })
  .handler(async ({ data }): Promise<DiagnosticoResult> => {
    if (!data) return { ok: false, reason: "invalid" };
    if (data.website?.trim()) return { ok: true };

    const { createRateLimiter } = await import("@/lib/security/ipRateLimit.server");
    limiter ??= createRateLimiter(MAX_PER_IP, WINDOW_MS);
    if (!limiter.allow(await rateKey())) return { ok: false, reason: "rate_limited" };

    const { saveDiagnosticoLead, notifyDiagnosticoLead } = await import("./diagnostico.server");
    const { outcome, ownerEmail } = await saveDiagnosticoLead(data);
    await notifyDiagnosticoLead(data, outcome, ownerEmail);
    // El visitante ve "gracias" aunque falle el guardado: queda en logs y en el correo,
    // y la página de gracias ofrece WhatsApp.
    return { ok: true };
  });
