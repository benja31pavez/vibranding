import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ClientIdInput = z.object({ clientId: z.string().uuid() });
const InviteInput = z.object({
  clientId: z.string().uuid(),
  email: z.string().trim().email().max(200),
});
const RevokeInput = z.object({ id: z.string().uuid() });

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
    const { data: allowed, error: guardError } = await context.supabase.rpc(
      "manages_client",
      { _client_id: data.clientId },
    );
    if (guardError) throw new Error(guardError.message);
    if (!allowed) throw new Error("No tienes permisos para invitar en este cliente");

    const origin = process.env["PUBLIC_SITE_URL"];
    if (!origin) throw new Error("PUBLIC_SITE_URL no está configurado");
    const redirectTo = `${origin.replace(/\/$/, "")}/reset-password`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    let userId: string | null = null;
    let inviteLink: string | null = null;

    const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (invited.data?.user) {
      userId = invited.data.user.id;
    } else {
      // Already registered or email delivery unavailable: fall back to a link.
      const link = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (link.error || !link.data?.user) {
        throw new Error(invited.error?.message ?? link.error?.message ?? "No se pudo invitar");
      }
      userId = link.data.user.id;
      inviteLink = link.data.properties?.action_link ?? null;
    }

    const { error } = await supabaseAdmin
      .from("client_users")
      .upsert({ user_id: userId!, client_id: data.clientId, email }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    return { ok: true, email, inviteLink };
  });

export const revokeClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => RevokeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_users").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
