/**
 * Server-side authorization helpers for actions that touch a client.
 *
 * Why not just `select` the client with the caller's session? The `clients`
 * RLS policy also lets the invited portal user (client_users / user_client_id())
 * see their own client, so "the row is visible" does NOT mean "the caller works
 * at the agency". Anything that spends the agency's Meta token or changes data
 * must go through these helpers instead.
 */
export type OrgRole = "owner" | "admin" | "agent" | "viewer";

/** Org roles allowed to modify a client's data (viewers are read-only). */
export const CLIENT_EDITOR_ROLES: readonly OrgRole[] = ["owner", "admin", "agent"];

export class ClientAccessError extends Error {
  readonly status: 401 | 403;
  constructor(message: string, status: 401 | 403 = 403) {
    super(message);
    this.name = "ClientAccessError";
    this.status = status;
  }
}

const NO_ACCESS = "No tienes acceso a este cliente";
const NO_EDIT = "Tu rol no permite modificar este cliente";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Agency org role of `userId` for the org that owns `clientId`, or null when the
 * user is not an org member (portal users are never org members).
 * Uses the service role so the answer does not depend on RLS details.
 */
export async function getClientOrgRole(userId: string, clientId: string): Promise<OrgRole | null> {
  if (!userId || !clientId || !UUID_RE.test(clientId)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: client, error: cErr } = await supabaseAdmin
    .from("clients")
    .select("org_id")
    .eq("id", clientId)
    .maybeSingle();
  if (cErr) {
    console.error("[clientAccess] client lookup failed", cErr.message);
    throw new Error("No se pudo verificar el acceso al cliente");
  }
  const orgId = (client as { org_id?: string } | null)?.org_id;
  if (!orgId) return null;

  const { data: member, error: mErr } = await (supabaseAdmin.from("org_members" as any) as any)
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (mErr) {
    console.error("[clientAccess] membership lookup failed", mErr.message);
    throw new Error("No se pudo verificar el acceso al cliente");
  }
  return ((member as { role?: OrgRole } | null)?.role ?? null) as OrgRole | null;
}

/** Throws unless the caller is owner/admin/agent of the client's org. */
export async function assertCanEditClient(userId: string, clientId: string): Promise<OrgRole> {
  const role = await getClientOrgRole(userId, clientId);
  if (!role) throw new ClientAccessError(NO_ACCESS);
  if (!CLIENT_EDITOR_ROLES.includes(role)) throw new ClientAccessError(NO_EDIT);
  return role;
}

/**
 * Resolves the user id behind a raw `Authorization: Bearer …` header (used by
 * the plain API routes that do not run the server-function middleware).
 */
export async function getUserIdFromAuthHeader(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

/**
 * For API routes: returns a JSON error Response when the caller cannot edit the
 * client, or null when access is granted.
 */
export async function denyUnlessClientEditor(
  authHeader: string | null,
  clientId: string | null | undefined,
): Promise<Response | null> {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const userId = await getUserIdFromAuthHeader(authHeader);
  if (!userId) return json({ error: "No autenticado" }, 401);
  if (!clientId) return json({ error: NO_ACCESS }, 403);
  try {
    await assertCanEditClient(userId, clientId);
    return null;
  } catch (e) {
    if (e instanceof ClientAccessError) return json({ error: e.message }, e.status);
    throw e;
  }
}

/**
 * Cross-org uniqueness of Meta assets. The RLS-scoped conflict checks only see
 * the caller's own org, so an editor of another agency could otherwise claim an
 * ad account / Instagram account already linked elsewhere. Checked with the
 * service role; the message does not reveal which client owns it.
 */
export async function assertMetaAssetsFree(
  clientId: string,
  assets: { adAccountId?: string | null; igAccountId?: string | null },
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const taken = async (column: "ad_account_id" | "ig_account_id", values: string[]) => {
    const { data, error } = await (supabaseAdmin.from("meta_accounts" as any) as any)
      .select("client_id")
      .in(column, values)
      .neq("client_id", clientId)
      .limit(1);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown[]).length > 0;
  };
  if (assets.adAccountId) {
    const bare = assets.adAccountId.replace(/^act_/, "");
    if (await taken("ad_account_id", [bare, `act_${bare}`])) {
      throw new Error("Esa cuenta publicitaria ya está asignada a otro cliente");
    }
  }
  if (assets.igAccountId && (await taken("ig_account_id", [assets.igAccountId]))) {
    throw new Error("Esa cuenta de Instagram ya está asignada a otro cliente");
  }
}
