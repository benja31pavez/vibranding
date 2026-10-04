import { createFileRoute } from "@tanstack/react-router";

const MAX_BODY_BYTES = 4096;
const MAX_TOKEN_LENGTH = 200;
const TOKEN_RE = /^[A-Za-z0-9_-]+$/;

const text = (body: string, status: number) => new Response(body, { status });

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
        const { getFlowPaymentStatus, FlowNotConfiguredError } =
          await import("@/lib/flow/flow.server");
        const { applyFlowStatus, loadPayment, paymentIdFromCommerceOrder } =
          await import("@/lib/flow/payments.server");

        try {
          const status = await getFlowPaymentStatus(token);

          const { data: byToken, error } = await supabaseAdmin
            .from("payments")
            .select("*")
            .eq("flow_token", token)
            .maybeSingle();
          if (error) throw new Error(`búsqueda por token: ${error.message}`);

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
          return result === "mismatch" ? text("Mismatch", 500) : text("OK", 200);
        } catch (e) {
          if (e instanceof FlowNotConfiguredError) {
            console.error("[flow confirm][ALERTA] Flow no está configurado");
          } else {
            console.error("[flow confirm][ALERTA] error al confirmar", (e as Error).message);
          }
          return text("Error", 500);
        }
      },
    },
  },
});
