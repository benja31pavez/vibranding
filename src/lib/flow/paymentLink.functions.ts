import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GenerateLinkInput = z.object({
  paymentId: z.string().uuid(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

export type GeneratePaymentLinkResult =
  | { state: "link"; paymentUrl: string; reused: boolean }
  | { state: "already_paid" };

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

    try {
      return await ensurePaymentLink(payment, data.email || null);
    } catch (e) {
      const { FlowNotConfiguredError } = await import("@/lib/flow/flow.server");
      if (!(e instanceof FlowNotConfiguredError)) throw e;
      console.error("[flow] link de pago sin configuración:", e.adminDetail);
      // El nombre de la variable solo se muestra a administradores de plataforma.
      const { isPlatformAdmin } = await import("@/lib/auth/platformAdmin.server");
      if (await isPlatformAdmin(context.userId)) throw new Error(`${e.message} (${e.adminDetail})`);
      throw new Error(e.message);
    }
  });
