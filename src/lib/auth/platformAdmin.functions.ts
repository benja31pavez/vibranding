import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { useAuth } from "@/hooks/use-auth";

/**
 * ¿El usuario actual es administrador de la plataforma (allowlist
 * PLATFORM_ADMIN_EMAILS)? Solo sirve para mostrar u ocultar UI: cada server fn
 * sensible vuelve a validar con assertPlatformAdmin.
 */
export const isPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { isPlatformAdmin: check } = await import("@/lib/auth/platformAdmin.server");
    return check(context.userId);
  });

/** Hook cacheado por usuario. Mientras carga o si falla, `data` es false/undefined (no admin). */
export function useIsPlatformAdmin() {
  const { user } = useAuth();
  const fetchIsAdmin = useServerFn(isPlatformAdmin);
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: ["platform-admin", userId],
    enabled: Boolean(userId),
    staleTime: 10 * 60_000,
    queryFn: () => fetchIsAdmin(),
  });
}
