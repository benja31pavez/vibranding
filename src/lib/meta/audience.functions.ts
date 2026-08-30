import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Refreshes this week's follower-demographics snapshot for one client. */
export const refreshAudienceSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; force?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: owned } = await context.supabase
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a este cliente");

    const { getClientMetaToken } = await import("@/lib/meta/clientToken.server");
    const resolved = await getClientMetaToken(data.clientId);
    if (!resolved) {
      return {
        ok: false as const,
        reason:
          "Este cliente no tiene una cuenta de Meta conectada. Conéctala con OAuth o con un token de System User.",
      };
    }
    if (!resolved.account.ig_account_id) {
      return {
        ok: false as const,
        reason: "Este cliente no tiene una cuenta de Instagram vinculada en Meta.",
      };
    }

    const { snapshotAudience } = await import("@/lib/meta/audience.server");
    return await snapshotAudience(
      data.clientId,
      resolved.account.ig_account_id,
      resolved.token,
      { force: data.force },
    );
  });

/** Graph version + metric names, so the UI can state them verbatim. */
export const audienceMethodology = createServerFn({ method: "GET" }).handler(async () => {
  const { methodology } = await import("@/lib/meta/audience.server");
  return methodology();
});
