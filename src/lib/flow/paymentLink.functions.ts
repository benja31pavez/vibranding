import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GenerateLinkInput = z.object({
  paymentId: z.string().uuid(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

export type GeneratePaymentLinkResult =
  { state: "link"; paymentUrl: string; reused: boolean } | { state: "already_paid" };

/**
 * Genera (o reutiliza) el link de pago de Flow de un cobro.
 * Guard: el usuario debe ser editor (owner/admin/agent) del cliente del cobro.
 */
export const generatePaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paymentId: string; email?: string }) => GenerateLinkInput.parse(d))
  .handler(async ({ data, context }): Promise<GeneratePaymentLinkResult> => {
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    const { loadPayment, ensurePaymentLink } = await import("@/lib/flow/payments.server");

    const payment = await loadPayment(data.paymentId);
    // Mismo mensaje si no existe o si no es tuyo: no revela qué ids existen.
    if (!payment) throw new Error("No tienes acceso a este cliente");
    await assertCanEditClient(context.userId, payment.client_id);

    return ensurePaymentLink(payment, data.email || null);
  });
