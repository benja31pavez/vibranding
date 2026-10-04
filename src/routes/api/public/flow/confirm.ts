import { createFileRoute } from "@tanstack/react-router";

const MAX_BODY_BYTES = 4096;
const MAX_TOKEN_LENGTH = 200;
const TOKEN_RE = /^[A-Za-z0-9_-]+$/;

const text = (body: string, status: number) => new Response(body, { status });

/**
 * Cache negativa por isolate: tokens que Flow ya rechazó (4xx ≠ 401) no
 * vuelven a consultarse durante 5 minutos. Acota el costo de POSTs basura;
 * el límite real va en una regla de rate limit de Cloudflare (ver PR).
 */
const NEGATIVE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_MAX_ENTRIES = 500;
const negativeCache = new Map<string, number>();

function isNegativelyCached(token: string, now = Date.now()): boolean {
  const at = negativeCache.get(token);
  if (at === undefined) return false;
  if (now - at < NEGATIVE_TTL_MS) return true;
  negativeCache.delete(token);
  return false;
}

function rememberNegative(token: string, now = Date.now()): void {
  negativeCache.delete(token);
  negativeCache.set(token, now);
  // Map conserva orden de inserción: se descartan las más antiguas.
  while (negativeCache.size > NEGATIVE_MAX_ENTRIES) {
    const oldest = negativeCache.keys().next().value;
    if (oldest === undefined) break;
    negativeCache.delete(oldest);
  }
}

/** 4xx que significan "Flow no reconoce este token". 401 = credenciales nuestras → alerta. */
const isClientError = (httpStatus: number) =>
  httpStatus >= 400 && httpStatus < 500 && httpStatus !== 401;

type TokenRead = { ok: true; token: string } | { ok: false; status: 400 | 413 };

/** Lee el body form-urlencoded con tope de 4 KB. */
async function readToken(request: Request): Promise<TokenRead> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return { ok: false, status: 413 };
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return { ok: false, status: 413 };
  const token = (new URLSearchParams(raw).get("token") ?? "").trim();
  if (!token || token.length > MAX_TOKEN_LENGTH || !TOKEN_RE.test(token)) {
    return { ok: false, status: 400 };
  }
  return { ok: true, token };
}

/**
 * urlConfirmation de Flow. Flow hace POST (x-www-form-urlencoded) con `token`.
 * Nunca se confía en el body: el estado real se consulta con payment/getStatus
 * firmado con nuestra secretKey.
 *
 * El cobro se busca por el flow_token guardado; si el token ya no está (link
 * regenerado), se resuelve por el commerceOrder que devuelve Flow (id o
 * id.sufijo), para que el pago de una orden vieja nunca se pierda.
 *
 * 200 = procesado o nada que hacer · 500 = requiere atención (Flow reintenta y
 * la alerta queda en el log).
 */
export const Route = createFileRoute("/api/public/flow/confirm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let read: TokenRead;
        try {
          read = await readToken(request);
        } catch {
          return text("Bad Request", 400);
        }
        if (!read.ok)
          return text(read.status === 413 ? "Payload Too Large" : "Bad Request", read.status);
        const { token } = read;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getFlowPaymentStatus, FlowApiError, FlowNotConfiguredError } =
          await import("@/lib/flow/flow.server");
        const { applyFlowStatus, loadPayment, paymentIdFromCommerceOrder } =
          await import("@/lib/flow/payments.server");

        try {
          // 1) Token conocido: es una orden nuestra; sin atajos.
          const { data: byToken, error } = await supabaseAdmin
            .from("payments")
            .select("*")
            .eq("flow_token", token)
            .maybeSingle();
          if (error) throw new Error(`búsqueda por token: ${error.message}`);

          // 2) Token desconocido ya rechazado por Flow hace poco: no volver a llamarlo.
          if (!byToken && isNegativelyCached(token)) return text("OK", 200);

          let status: Awaited<ReturnType<typeof getFlowPaymentStatus>>;
          try {
            status = await getFlowPaymentStatus(token);
          } catch (e) {
            const rejected = e instanceof FlowApiError && isClientError(e.httpStatus);
            if (!byToken && rejected) {
              // Flow no reconoce el token: no es una orden real. Sin alerta.
              rememberNegative(token);
              console.warn("[flow confirm] token desconocido rechazado por Flow", {
                httpStatus: (e as InstanceType<typeof FlowApiError>).httpStatus,
                code: (e as InstanceType<typeof FlowApiError>).code,
              });
              return text("OK", 200);
            }
            throw e; // 401, red/timeout o token conocido → 500 (Flow reintenta)
          }

          const fallbackId = byToken
            ? null
            : paymentIdFromCommerceOrder(String(status.commerceOrder ?? ""));
          const payment = byToken ?? (fallbackId ? await loadPayment(fallbackId) : null);
          if (!payment) {
            console.error("[flow confirm][ALERTA] orden de Flow sin cobro asociado", {
              commerceOrder: status.commerceOrder,
              flowOrder: status.flowOrder,
              flowStatus: status.status,
              amount: status.amount,
              currency: status.currency,
            });
            return text("Unknown order", 500);
          }

          const result = await applyFlowStatus(payment, status);
          console.info("[flow confirm]", {
            paymentId: payment.id,
            via: byToken ? "token" : "commerceOrder",
            flowOrder: status.flowOrder,
            flowStatus: status.status,
            result,
          });
          // mismatch: Flow cobró algo que no pudimos registrar → alerta y reintento.
          // duplicate: ya alertado y anotado; reintentar no lo arregla → 200.
          return result === "mismatch" ? text("Mismatch", 500) : text("OK", 200);
        } catch (e) {
          if (e instanceof FlowNotConfiguredError) {
            console.error("[flow confirm][ALERTA] Flow no está configurado:", e.adminDetail);
          } else {
            console.error("[flow confirm][ALERTA] error al confirmar", (e as Error).message);
          }
          return text("Error", 500);
        }
      },
    },
  },
});
