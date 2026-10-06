/**
 * "¿Este usuario es miembro de una org (y no cliente)?" para server functions
 * de nivel org que no reciben un clientId (configuración de la org, token de
 * Meta de la org, listados por RLS).
 *
 * NO sirve para datos globales de la plataforma (todos los tenants, jobs,
 * crons): esos usan assertPlatformAdmin (platformAdmin.server.ts).
 *
 * Ojo: tener org NO es ser Vibranding (cualquier cuenta nueva queda owner de
 * su propia org vacía vía ensure_org()). Esto solo garantiza que el usuario es
 * miembro de ALGUNA org y que NO es un usuario cliente (client_users). Para
 * datos de un cliente concreto usa assertCanEditClient / getClientOrgRole
 * (clientAccess.server.ts), que verifican la org DUEÑA de ese cliente.
 *
 * Falla cerrado: si la verificación no se puede hacer, se niega el acceso.
 */
import { ClientAccessError, type OrgRole } from "./clientAccess.server";

export interface OrgMembership {
  orgId: string;
  role: OrgRole;
}

const NOT_AGENCY = "Esta función es solo para el equipo de la agencia";
const CHECK_FAILED = "No se pudo verificar tu acceso";

export async function getOrgMembership(userId: string): Promise<OrgMembership | null> {
  if (!userId) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const [clientRes, memberRes] = await Promise.all([
    db.from("client_users").select("id").eq("user_id", userId).limit(1),
    db
      .from("org_members")
      .select("org_id,role,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);
  if (clientRes.error || memberRes.error) {
    console.error("[orgAccess] membership lookup failed", {
      clientUsers: clientRes.error?.message,
      orgMembers: memberRes.error?.message,
    });
    throw new Error(CHECK_FAILED);
  }
  // Un usuario cliente nunca es agencia, aunque por error tuviera fila en org_members.
  if ((clientRes.data ?? []).length > 0) return null;
  const row = (memberRes.data ?? [])[0] as { org_id?: string; role?: OrgRole } | undefined;
  if (!row?.org_id || !row.role) return null;
  return { orgId: row.org_id, role: row.role };
}

/** Lanza ClientAccessError (403) salvo que el usuario sea miembro de una org y no cliente. */
export async function assertOrgMember(userId: string): Promise<OrgMembership> {
  const membership = await getOrgMembership(userId);
  if (!membership) throw new ClientAccessError(NOT_AGENCY);
  return membership;
}
