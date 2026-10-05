import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EngagementSnapshot } from "@/lib/instagram/engagement";

export type EngagementView = {
  /** False until the ig_engagement_snapshots migration is applied. */
  available: boolean;
  canEdit: boolean;
  snapshot: EngagementSnapshot | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateClientId(input: unknown): { clientId: string } {
  const clientId = (input as { clientId?: unknown } | null)?.clientId;
  if (typeof clientId !== "string" || !UUID_RE.test(clientId)) {
    throw new Error("Cliente inválido");
  }
  return { clientId };
}

/** Latest stored engagement measurement. Any agency org member (incl. viewers). */
export const getIgEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateClientId)
  .handler(async ({ data, context }): Promise<EngagementView> => {
    const { getClientOrgRole, ClientAccessError, CLIENT_EDITOR_ROLES } =
      await import("@/lib/auth/clientAccess.server");
    const role = await getClientOrgRole(context.userId, data.clientId);
    if (!role) throw new ClientAccessError("No tienes acceso a este cliente");

    const { readLatestSnapshot } = await import("@/lib/instagram/engagement.server");
    const read = await readLatestSnapshot(data.clientId);
    return {
      available: read.status === "ok",
      canEdit: CLIENT_EDITOR_ROLES.includes(role),
      snapshot: read.status === "ok" ? read.snapshot : null,
    };
  });

/** "Actualizar": measures with the Graph API (12 h cache). Editors only. */
export const refreshIgEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateClientId)
  .handler(async ({ data, context }) => {
    // Spends the agency's Meta token: agency editors only (no viewers, no portal).
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, data.clientId);

    const { refreshEngagement } = await import("@/lib/instagram/engagement.server");
    return await refreshEngagement(data.clientId);
  });
