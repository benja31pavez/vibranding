import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Middleware para server functions de agencia: exige sesión (requireSupabaseAuth)
 * y que el usuario sea miembro de una org y NO usuario cliente. Agrega
 * `context.agency` ({ orgId, role }). Falla cerrado.
 *
 * No reemplaza assertCanEditClient: si la función recibe un clientId, igual hay
 * que verificar la org dueña de ESE cliente.
 *
 * Uso: createServerFn(...).middleware([requireAgencyMember]).handler(...)
 */
export const requireAgencyMember = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { assertAgencyMember } = await import("./agencyAccess.server");
    const agency = await assertAgencyMember(context.userId);
    return next({ context: { agency } });
  });
