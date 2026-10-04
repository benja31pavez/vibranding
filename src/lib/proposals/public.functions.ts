/**
 * Server functions públicas (sin sesión) de la propuesta /p/$token.
 * Todo lo sensible (service role, hash de IP, Flow) ocurre en el servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { isValidRut, formatRut } from "./rut";
import type { AcceptResult, PublicProposalResult, StartPaymentResult } from "./public.server";

const Token = z.string().regex(/^[0-9a-f]{48}$/, "Link inválido");
const OptionalEmail = z.string().trim().email().max(200).optional().or(z.literal(""));

/** Intentos por IP y hora (aceptar y "Pagar ahora" comparten contador). */
const ATTEMPTS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;
const RATE_LIMITED = "Demasiados intentos desde tu conexión. Espera un rato y vuelve a intentarlo.";

async function limiter() {
  const mod = await import("@/lib/security/ipRateLimit.server");
  limiterInstance ??= mod.createIpRateLimiter(ATTEMPTS_PER_HOUR, HOUR_MS);
  return { limiter: limiterInstance, clientIpHash: mod.clientIpHash };
}
let limiterInstance: import("@/lib/security/ipRateLimit.server").IpRateLimiter | undefined;

const GetInput = z.object({ token: z.string().max(128), vista: z.string().max(20).optional() });

/** Carga la propuesta y, si es una persona (no un bot de vista previa), la marca "vista". */
export const getPublicProposal = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string; vista?: string }) => GetInput.parse(d))
  .handler(async ({ data }): Promise<PublicProposalResult> => {
    const { loadPublicProposal } = await import("./public.server");
    const req = getRequest();
    return loadPublicProposal(data.token, {
      method: req?.method ?? "GET",
      headers: req?.headers ?? new Headers(),
      vistaParam: data.vista ?? null,
    });
  });

const AcceptInput = z.object({
  token: Token,
  name: z.string().trim().min(3, "Escribe tu nombre completo").max(120),
  rut: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidRut(v), "RUT inválido"),
  email: OptionalEmail,
  accepted: z.literal(true, { message: "Debes aceptar las condiciones" }),
});
export type AcceptInputData = z.input<typeof AcceptInput>;

export const acceptProposal = createServerFn({ method: "POST" })
  .inputValidator((d: AcceptInputData) => AcceptInput.parse(d))
  .handler(async ({ data }): Promise<AcceptResult> => {
    const { limiter: rl, clientIpHash } = await limiter();
    const ipHash = await clientIpHash();
    if (!rl.allow(ipHash)) return { ok: false, reason: "error", message: RATE_LIMITED };

    const { acceptPublicProposal } = await import("./public.server");
    return acceptPublicProposal({
      token: data.token,
      name: data.name,
      rut: data.rut ? formatRut(data.rut) : null,
      email: data.email || null,
      ipHash,
    });
  });

const PayInput = z.object({ token: Token, email: OptionalEmail });

/** "Pagar ahora": devuelve el link de Flow del cobro de la propuesta aceptada. */
export const startProposalPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; email?: string }) => PayInput.parse(d))
  .handler(async ({ data }): Promise<StartPaymentResult> => {
    const { limiter: rl, clientIpHash } = await limiter();
    if (!rl.allow(await clientIpHash())) return { state: "unavailable", message: RATE_LIMITED };
    const { startProposalPayment: start } = await import("./public.server");
    return start(data.token, data.email || null);
  });
