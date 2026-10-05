import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ResolveInput = z.object({ alertId: z.string().uuid() });

export type ResolveAlertResult = { status: "resolved" | "already_resolved" };

/**
 * "Marcar como resuelta". La política RLS de campaign_alerts ya permite el
 * update a editores (can_edit_client), pero se hace en el servidor para que
 * resolved_by sea siempre el usuario real: el motor de alertas usa ese campo
 * para no reabrir durante unos días una alerta que alguien cerró a mano.
 */
export const resolveCampaignAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { alertId: string }) => ResolveInput.parse(d))
  .handler(async ({ data, context }): Promise<ResolveAlertResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: alert, error: readErr } = await supabaseAdmin
      .from("campaign_alerts")
      .select("id,client_id,resolved_at")
      .eq("id", data.alertId)
      .maybeSingle();
    if (readErr) {
      console.error("[alerts] lectura para resolver", readErr.message);
      throw new Error("No se pudo leer la alerta. Inténtalo de nuevo.");
    }
    // Mismo mensaje si no existe o si es de otra org: no revela qué ids existen.
    if (!alert) throw new Error("No tienes acceso a esta alerta");

    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, alert.client_id);
    if (alert.resolved_at) return { status: "already_resolved" };

    const { data: updated, error } = await supabaseAdmin
      .from("campaign_alerts")
      .update({ resolved_at: new Date().toISOString(), resolved_by: context.userId })
      .eq("id", alert.id)
      .is("resolved_at", null)
      .select("id");
    if (error) {
      console.error("[alerts] resolver", error.message);
      throw new Error("No se pudo marcar la alerta como resuelta. Inténtalo de nuevo.");
    }
    // 0 filas: otra persona (o el motor) la resolvió entre la lectura y el update.
    return { status: updated && updated.length > 0 ? "resolved" : "already_resolved" };
  });
