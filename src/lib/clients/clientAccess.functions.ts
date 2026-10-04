import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ClientIdInput = z.object({ clientId: z.string().uuid() });
const InviteInput = z.object({
  clientId: z.string().uuid(),
  email: z.string().trim().email().max(200),
});
const RevokeInput = z.object({ id: z.string().uuid() });

/**
 * Blocked invites (address already tied to another client's portal or to an
 * agency org) are logged server-side but answered exactly like a successful
 * one, so the endpoint cannot be used to probe which emails exist or where.
 */
function logBlockedInvite(reason: string, clientId: string, userId: string) {
  console.warn("[clientAccess] portal invite blocked", { reason, clientId, userId });
}

/** Users with read-only access to a client. */
export const listClientUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string }) => ClientIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_users")
      .select("id,user_id,email,created_at")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Invite a client by email; they set a password and land on their analytics. */
export const inviteClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; email: string }) => InviteInput.parse(d))
  .handler(async ({ data, context }) => {
    // Only owners/admins of the client's org may invite.
    const { data: allowed, error: guardError } = await context.supabase.rpc("manages_client", {
      _client_id: data.clientId,
    });
    if (guardError) throw new Error(guardError.message);
    if (!allowed) throw new Error("No tienes permisos para invitar en este cliente");

    const origin = process.env["PUBLIC_SITE_URL"];
    if (!origin) throw new Error("PUBLIC_SITE_URL no está configurado");
    const redirectTo = `${origin.replace(/\/$/, "")}/reset-password`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    /** Find an existing auth user by email without minting a recovery link. */
    const findExistingUserId = async (target: string): Promise<string | null> => {
      const perPage = 200;
      for (let page = 1; page <= 25; page++) {
        const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error) throw new Error(error.message);
        const match = list.users.find((u) => (u.email ?? "").toLowerCase() === target);
        if (match) return match.id;
        if (list.users.length < perPage) return null;
      }
      return null;
    };

    let userId: string | null = null;

    const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (invited.data?.user) {
      userId = invited.data.user.id;
    } else {
      // The invite fails when the address already has an account. Grant access to that
      // account instead of minting a recovery link: returning such a link to the caller
      // would let any org admin take over any existing user's account.
      userId = await findExistingUserId(email);
      if (!userId) throw new Error(invited.error?.message ?? "No se pudo invitar");
    }

    // Never move an existing account: a user that already belongs to another
    // client's portal, or to any agency org, must not be silently reassigned
    // (that would cut off their access or hand them a different tenant).
    const { data: currentLink, error: linkError } = await supabaseAdmin
      .from("client_users")
      .select("client_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (linkError) throw new Error("No se pudo verificar el correo");
    if (currentLink && currentLink.client_id !== data.clientId) {
      logBlockedInvite("linked_to_other_client", data.clientId, userId);
      return { ok: true, email };
    }

    const { data: membership, error: memberError } = await (
      supabaseAdmin.from("org_members" as any) as any
    )
      .select("id")
      .eq("user_id", userId)
      .limit(1);
    if (memberError) throw new Error("No se pudo verificar el correo");
    if (((membership ?? []) as unknown[]).length > 0) {
      logBlockedInvite("org_member", data.clientId, userId);
      return { ok: true, email };
    }

    if (!currentLink) {
      const { error } = await supabaseAdmin
        .from("client_users")
        .insert({ user_id: userId, client_id: data.clientId, email });
      if (error?.code === "23505") {
        // Raced with another invite for the same account: treat as blocked.
        logBlockedInvite("unique_conflict", data.clientId, userId);
        return { ok: true, email };
      }
      if (error) throw new Error(error.message);
    }

    // Same response whether the address was new or already registered, so the
    // endpoint cannot be used to discover which emails have an account.
    return { ok: true, email };
  });

export const revokeClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => RevokeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_users").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
