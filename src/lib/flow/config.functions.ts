import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { useAuth } from "@/hooks/use-auth";

export interface FlowConfigStatus {
  configured: boolean;
  /** Variables faltantes: solo se envían a administradores de plataforma. */
  missing: string[] | null;
}

/** ¿Está Flow listo para generar links de pago reales? */
export const isFlowConfigured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FlowConfigStatus> => {
    const { missingFlowConfig } = await import("@/lib/flow/flow.server");
    const { isPlatformAdmin } = await import("@/lib/auth/platformAdmin.server");
    const missing = missingFlowConfig();
    const admin = missing.length > 0 && (await isPlatformAdmin(context.userId));
    return { configured: missing.length === 0, missing: admin ? missing : null };
  });

export function useFlowConfigured() {
  const { user } = useAuth();
  const fetchStatus = useServerFn(isFlowConfigured);
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: ["flow-configured", userId],
    enabled: Boolean(userId),
    staleTime: 10 * 60_000,
    queryFn: () => fetchStatus(),
  });
}
