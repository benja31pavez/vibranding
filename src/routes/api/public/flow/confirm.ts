import { createFileRoute } from "@tanstack/react-router";

const MAX_TOKEN_LENGTH = 200;
const TOKEN_RE = /^[A-Za-z0-9_-]+$/;

/**
 * urlConfirmation de Flow. Flow hace POST (x-www-form-urlencoded) con `token`.
 * Nunca se confía en el body: el estado real se consulta con payment/getStatus
 * firmado con nuestra secretKey, y el cobro se busca por el flow_token guardado.
 * Idempotente: confirmar dos veces el mismo pago no cambia nada.
 */
export const Route = createFileRoute("/api/public/flow/confirm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let token = "";
        try {
          const form = await request.formData();
          token = String(form.get("token") ?? "").trim();
        } catch {
          return new Response("Bad Request", { status: 400 });
        }
        if (!token || token.length > MAX_TOKEN_LENGTH || !TOKEN_RE.test(token)) {
          return new Response("Bad Request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: payment, error } = await supabaseAdmin
          .from("payments")
          .select("*")
          .eq("flow_token", token)
          .maybeSingle();
        if (error) {
          console.error("[flow confirm] no se pudo buscar el cobro", error.message);
          return new Response("Error", { status: 500 });
        }
        if (!payment) {
          // Token desconocido: respondemos 200 para no dar pistas ni provocar reintentos.
          console.warn("[flow confirm] token sin cobro asociado");
          return new Response("OK", { status: 200 });
        }

        const { getFlowPaymentStatus, FlowNotConfiguredError } =
          await import("@/lib/flow/flow.server");
        const { applyFlowStatus } = await import("@/lib/flow/payments.server");
        try {
          const status = await getFlowPaymentStatus(token);
          const result = await applyFlowStatus(payment, status);
          console.info("[flow confirm]", {
            paymentId: payment.id,
            flowStatus: status.status,
            result,
          });
          return new Response("OK", { status: 200 });
        } catch (e) {
          if (e instanceof FlowNotConfiguredError) {
            console.error("[flow confirm] Flow no está configurado");
          } else {
            console.error("[flow confirm] error al confirmar", payment.id, (e as Error).message);
          }
          // 500 → Flow puede reintentar la notificación.
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});
