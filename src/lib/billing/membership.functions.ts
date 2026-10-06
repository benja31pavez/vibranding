import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { useAuth } from "@/hooks/use-auth";
import { PLAN_KEYS } from "@/lib/pricing/plans";
import type { Membership } from "./membership";
import type { CheckoutResult } from "./membership.server";

const NO_ACCESS = "No tienes acceso a este cliente";

const ClientInput = z.object({ clientId: z.string().uuid() });
const CheckoutInput = z.object({
  clientId: z.string().uuid(),
  planKey: z.enum(PLAN_KEYS),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

type AuthContext = {
  userId: string;
  supabase: import("@/lib/portal/portal.server").Db;
};

/**
 * Quién actúa sobre `clientId`, con verificación estricta:
 *  - Usuario cliente: solo SU cliente (user_client_id(), nunca el input).
 *  - Agencia: lectura con owns_client; pagar con can_edit_client.
 * Mismo mensaje si el cliente no existe o no es tuyo.
 */
async function assertMembershipAccess(
  context: AuthContext,
  clientId: string,
  mode: "read" | "pay",
): Promise<"client" | "agency"> {
  const { resolvePortalClientId } = await import("@/lib/portal/portal.server");
  const own = await resolvePortalClientId(context.supabase);
  if (own) {
    if (own !== clientId) throw new Error(NO_ACCESS);
    return "client";
  }
  const rpc = mode === "pay" ? "can_edit_client" : "owns_client";
  const { data, error } = await context.supabase.rpc(rpc, { _client_id: clientId });
  if (error) {
    console.error("[membresía] no se pudo verificar el acceso", rpc, error.message);
    throw new Error("No se pudo verificar el acceso al cliente");
  }
  if (data !== true) throw new Error(NO_ACCESS);
  return "agency";
}

/** Estado del plan del cliente (derivado de sus pagos). */
export const getClientMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string }) => ClientInput.parse(d))
  .handler(async ({ data, context }): Promise<Membership> => {
    await assertMembershipAccess(context, data.clientId, "read");
    const { loadMembership } = await import("./membership.server");
    return loadMembership(data.clientId);
  });

/**
 * "Contratar y pagar" / "Renovar": crea (o reutiliza) el cobro del plan con el
 * precio de plans.ts y devuelve el link de Flow. Lo puede iniciar la agencia
 * (editor) o, cuando tenga acceso, el usuario cliente.
 */
export const startPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; planKey: string; email?: string }) =>
    CheckoutInput.parse(d),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    await assertMembershipAccess(context, data.clientId, "pay");
    const { startMembershipCheckout } = await import("./membership.server");
    try {
      return await startMembershipCheckout({
        clientId: data.clientId,
        planKey: data.planKey,
        email: data.email || null,
      });
    } catch (e) {
      const { FlowNotConfiguredError } = await import("@/lib/flow/flow.server");
      if (!(e instanceof FlowNotConfiguredError)) throw e;
      console.error("[membresía] Flow sin configuración:", e.adminDetail);
      throw new Error("Pago en línea aún no disponible");
    }
  });

export const membershipKey = (userId: string, clientId: string) =>
  ["membership", userId, clientId] as const;

export function useMembership(clientId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const fetchMembership = useServerFn(getClientMembership);
  return useQuery({
    queryKey: membershipKey(userId, clientId),
    enabled: Boolean(userId && clientId),
    queryFn: () => fetchMembership({ data: { clientId } }),
  });
}
