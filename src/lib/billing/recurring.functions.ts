import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MonthlyChargeSummary } from "./recurring.server";

/**
 * Ejecuta a mano el cobro mensual recurrente (el mismo que corre el cron).
 * Recorre suscripciones de todas las orgs, así que solo un administrador de la
 * plataforma (PLATFORM_ADMIN_EMAILS) puede lanzarlo.
 */
export const runMonthlyChargesNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MonthlyChargeSummary> => {
    const { assertPlatformAdmin } = await import("@/lib/auth/platformAdmin.server");
    await assertPlatformAdmin(context.userId);
    const { runMonthlyCharges } = await import("./recurring.server");
    return runMonthlyCharges();
  });
