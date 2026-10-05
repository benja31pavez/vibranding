/**
 * Server functions públicas (sin sesión) de la propuesta /p/$token.
 * Todo lo sensible (service role, hash de IP, Flow) ocurre en el servidor.
 *
 * Límites en memoria por instancia (clave = IP; sin IP, bucket por token):
 *  - ver la propuesta: 60 cargas / 10 min
 *  - aceptar + "Pagar ahora": 10 intentos / hora (contador compartido)
 *  - "vista": como máximo 1 intento de marcar por token cada 10 min
 *  - links de Flow: máximo 3 por token por hora (en public.server.ts)
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { isValidRut, formatRut } from "./rut";
import { allowPublicView, privateHeaders, RATE_LIMITED } from "@/lib/security/publicToken";
import type { AcceptResult, PublicProposalResult, StartPaymentResult } from "./public.server";

const Token = z.string().regex(/^[0-9a-f]{48}$/, "Link inválido");
const OptionalEmail = z.string().trim().email().max(200).optional().or(z.literal(""));

const MINUTE = 60 * 1000;
let writeLimiter: import("@/lib/security/ipRateLimit.server").RateLimiter | undefined;

async function security() {
  const mod = await import("@/lib/security/ipRateLimit.server");
  writeLimiter ??= mod.createRateLimiter(10, 60 * MINUTE);
  return { write: writeLimiter, limitKey: mod.limitKey, clientIpHash: mod.clientIpHash };
}

const GetInput = z.object({ token: z.string().max(128), vista: z.string().max(20).optional() });

/** Carga la propuesta y, si es una persona (no un bot de vista previa), la marca "vista". */
export const getPublicProposal = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; vista?: string }) => GetInput.parse(d))
  .handler(async ({ data }): Promise<PublicProposalResult> => {
    privateHeaders();
    if (!(await allowPublicView("view", data.token))) throw new Error(RATE_LIMITED);

    const { loadPublicProposal } = await import("./public.server");
    const req = getRequest();
    return loadPublicProposal(data.token, {
      method: req?.method ?? "GET",
      headers: req?.headers ?? new Headers(),
      vistaParam: data.vista ?? null,
    });
  });

/** Nombre: sin saltos de línea ni caracteres de control (va al texto aceptado). */
const PersonName = z
  .string()
  .trim()
  .min(3, "Escribe tu nombre completo")
  .max(120)
  .regex(/^[^\p{Cc}\p{Cf}\u2028\u2029]+$/u, "El nombre tiene caracteres no permitidos");

const AcceptInput = z.object({
  token: Token,
  name: PersonName,
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
    privateHeaders();
    const { write, limitKey, clientIpHash } = await security();
    if (!write.allow(limitKey("write", data.token))) return { ok: false, reason: "error", message: RATE_LIMITED };

    let ipHash: string | null;
    try {
      ipHash = await clientIpHash();
    } catch (e) {
      console.error("[proposals] [ALERTA] no se puede aceptar sin IP_HASH_SALT", e);
      return { ok: false, reason: "error", message: "No pudimos registrar tu aceptación. Escríbenos y lo resolvemos." };
    }

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
    privateHeaders();
    const { write, limitKey } = await security();
    if (!write.allow(limitKey("write", data.token))) return { state: "unavailable", message: RATE_LIMITED };
    const { startProposalPayment: start } = await import("./public.server");
    return start(data.token, data.email || null);
  });
