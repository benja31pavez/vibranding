import { createServerFn } from "@tanstack/react-start";
import { DiagnosticoInput, isHoneypotHit, type DiagnosticoResult } from "./diagnostico.schema";
import { resultForOutcome } from "./diagnostico.outcome";

const MAX_PER_CLIENT = 5;
/** Tope global (todas las IPs) por hora: freno ante abuso distribuido. */
const MAX_GLOBAL_PER_HOUR = 60;
const WINDOW_MS = 60 * 60 * 1000;

type Limiter = import("@/lib/security/ipRateLimit.server").RateLimiter;
/** Instancias por Worker (best effort, ver ipRateLimit.server.ts). */
let perClient: Limiter | null = null;
let globalFallback: Limiter | null = null;

type Validated = { honeypot: true } | { honeypot: false; data: DiagnosticoInput | null };

async function sha256(value: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(value).digest("hex");
}

/** Hash salado de la IP para guardar con el consentimiento; null si no hay IP o sal. */
async function ipHashOrNull(): Promise<string | null> {
  const { clientIpHash, MissingSaltError } = await import("@/lib/security/ipRateLimit.server");
  try {
    return await clientIpHash();
  } catch (e) {
    if (e instanceof MissingSaltError) {
      console.error("[diagnostico] falta IP_HASH_SALT");
      return null;
    }
    throw e;
  }
}

/**
 * Clave del límite por cliente: hash de la IP; sin IP, hash de user-agent +
 * accept-language (nunca un cubo único compartido por todos los "sin IP").
 */
async function clientKey(ipHash: string | null): Promise<string> {
  if (ipHash) return `diagnostico:ip:${ipHash}`;
  const { clientIp } = await import("@/lib/security/ipRateLimit.server");
  const { getRequest } = await import("@tanstack/react-start/server");
  const ip = clientIp();
  if (ip) return `diagnostico:ip:${await sha256(ip)}`;
  const h = getRequest()?.headers;
  return `diagnostico:ua:${await sha256(`${h?.get("user-agent") ?? ""}|${h?.get("accept-language") ?? ""}`)}`;
}

/** Tope global en BD (diagnostico_rate_hit); si la migración aún no está, en memoria. */
async function allowGlobal(): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: boolean | null; error: { code?: string } | null }>;
    const { data, error } = await rpc.call(supabaseAdmin, "diagnostico_rate_hit", { _limit: MAX_GLOBAL_PER_HOUR });
    if (!error) return data !== false;
    console.error(`[diagnostico] diagnostico_rate_hit falló (code ${error.code ?? "?"}): uso el tope en memoria`);
  } catch {
    console.error("[diagnostico] tope global en BD no disponible: uso el tope en memoria");
  }
  const { createRateLimiter } = await import("@/lib/security/ipRateLimit.server");
  globalFallback ??= createRateLimiter(MAX_GLOBAL_PER_HOUR, WINDOW_MS);
  return globalFallback.allow("diagnostico:global");
}

/**
 * Formulario público "Diagnóstico gratis": crea (o anota) un prospecto en la
 * org del administrador de la plataforma, registra el consentimiento y avisa
 * por correo si hay Resend. Honeypot (cualquier largo) → ok sin guardar nada.
 * Si el lead no queda guardado → { ok: false, reason: "not_saved" } (fallback WhatsApp).
 * Límites: 5/h por cliente y 60/h global.
 */
export const submitDiagnostico = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): Validated => {
    if (isHoneypotHit(input)) return { honeypot: true };
    const parsed = DiagnosticoInput.safeParse(input);
    return { honeypot: false, data: parsed.success ? parsed.data : null };
  })
  .handler(async ({ data: v }): Promise<DiagnosticoResult> => {
    if (v.honeypot) return { ok: true };
    const data = v.data;
    if (!data) return { ok: false, reason: "invalid" };

    const { createRateLimiter } = await import("@/lib/security/ipRateLimit.server");
    perClient ??= createRateLimiter(MAX_PER_CLIENT, WINDOW_MS);
    const ipHash = await ipHashOrNull();
    if (!perClient.allow(await clientKey(ipHash))) return { ok: false, reason: "rate_limited" };
    if (!(await allowGlobal())) return { ok: false, reason: "rate_limited" };

    const { saveDiagnosticoLead, notifyDiagnosticoLead } = await import("./diagnostico.server");
    const { outcome, ownerEmail } = await saveDiagnosticoLead(data, ipHash);
    await notifyDiagnosticoLead(data, outcome, ownerEmail);
    // Si no quedó guardado, el visitante ve el aviso con WhatsApp (no un "gracias" falso).
    return resultForOutcome(outcome);
  });
