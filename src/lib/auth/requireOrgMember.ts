import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Middleware para server functions de nivel org: exige sesión (requireSupabaseAuth)
 * y que el usuario sea miembro de una org y NO usuario cliente. Agrega
 * `context.org` ({ orgId, role }). Falla cerrado.
 *
 * Ojo: ser miembro de una org NO es ser Vibranding (cualquier cuenta nueva es
 * owner de su propia org vía ensure_org()). Por eso:
 *  - NO sirve para datos globales de la plataforma (jobs, crons, todos los
 *    tenants): esos usan assertPlatformAdmin (platformAdmin.server.ts).
 *  - NO reemplaza assertCanEditClient: si la función recibe un clientId, igual
 *    hay que verificar la org dueña de ESE cliente.
 *
 * Uso: createServerFn(...).middleware([requireOrgMember]).handler(...)
 */
export const requireOrgMember = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { assertOrgMember } = await import("./orgAccess.server");
    const org = await assertOrgMember(context.userId);
    return next({ context: { org } });
  });
