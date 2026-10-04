/**
 * Server functions públicas (sin sesión) del onboarding /onboarding/$token.
 *
 * Límites en memoria por instancia (clave = IP; sin IP, bucket por token):
 *  - ver el formulario: 60 cargas / 10 min
 *  - firmar subidas: 40 / hora por IP y 30 / hora por token
 *  - enviar: 10 intentos / hora por IP y 10 / hora por token
 * Son best effort (ver ipRateLimit.server.ts); la BD valida token y payload.
 */
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import type { OnboardingInfo, SubmitResult, UploadUrlResult } from "./public.server";
import { PayloadSchema, TOKEN_RE, UploadRequest, zodFieldError, type OnboardingPayload, type UploadRequestData } from "./schema";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const RATE_LIMITED = "Demasiados intentos desde tu conexión. Espera un rato y vuelve a intentarlo.";

type Limiter = import("@/lib/security/ipRateLimit.server").RateLimiter;
let limiters: { view: Limiter; uploadIp: Limiter; uploadToken: Limiter; submitIp: Limiter; submitToken: Limiter } | undefined;

async function security() {
  const mod = await import("@/lib/security/ipRateLimit.server");
  limiters ??= {
    view: mod.createRateLimiter(60, 10 * MINUTE),
    uploadIp: mod.createRateLimiter(40, HOUR),
    uploadToken: mod.createRateLimiter(30, HOUR),
    submitIp: mod.createRateLimiter(10, HOUR),
    submitToken: mod.createRateLimiter(10, HOUR),
  };
  return { ...limiters, limitKey: mod.limitKey };
}

/** Respuestas con datos del cliente: nunca en caché ni indexables. */
function privateHeaders() {
  setResponseHeaders(
    new Headers({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    }),
  );
}

const ViewInput = z.object({ token: z.string().max(128) });

/** Nombre del cliente y vigencia del link (solo lectura). */
export const getOnboarding = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => ViewInput.parse(d))
  .handler(async ({ data }): Promise<OnboardingInfo> => {
    privateHeaders();
    const { view, limitKey } = await security();
    if (!view.allow(limitKey("onb-view", data.token))) throw new Error(RATE_LIMITED);
    const { loadOnboarding } = await import("./public.server");
    return loadOnboarding(data.token);
  });

/** URL firmada para subir UN archivo directo a Storage (bucket privado 'onboarding'). */
export const createOnboardingUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: UploadRequestData) => UploadRequest.parse(d))
  .handler(async ({ data }): Promise<UploadUrlResult> => {
    privateHeaders();
    const { uploadIp, uploadToken, limitKey } = await security();
    if (!uploadToken.allow(`onb-upload:token:${data.token}`) || !uploadIp.allow(limitKey("onb-upload", data.token))) {
      return { ok: false, message: RATE_LIMITED };
    }
    const { createUploadUrl } = await import("./public.server");
    return createUploadUrl(data);
  });

/** Forma y tamaño aquí; reglas de campo con PayloadSchema (y de nuevo en la BD). */
const SubmitInput = z.object({
  token: z.string().regex(TOKEN_RE, "Link inválido"),
  payload: z.record(z.unknown()).refine((p) => JSON.stringify(p).length <= 70_000, "Formulario demasiado grande"),
});

export const submitOnboarding = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; payload: OnboardingPayload }) => SubmitInput.parse(d))
  .handler(async ({ data }): Promise<SubmitResult> => {
    privateHeaders();
    const { submitIp, submitToken, limitKey } = await security();
    if (!submitToken.allow(`onb-submit:token:${data.token}`) || !submitIp.allow(limitKey("onb-submit", data.token))) {
      return { ok: false, reason: "error", message: RATE_LIMITED };
    }
    const parsed = PayloadSchema.safeParse(data.payload);
    if (!parsed.success) return { ok: false, reason: "invalid_payload", error: zodFieldError(parsed.error) };
    const { submitOnboardingPayload } = await import("./public.server");
    // La BD normaliza (minúsculas, vacíos → NULL) y vuelve a validar todo.
    return submitOnboardingPayload(data.token, parsed.data as OnboardingPayload);
  });
