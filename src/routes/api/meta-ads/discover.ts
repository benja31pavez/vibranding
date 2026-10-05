import { graphBase } from "@/lib/meta/version";
import { denyUnlessClientEditor } from "@/lib/auth/clientAccess.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Lists the ad accounts / pages / Instagram accounts reachable with the token
 * stored in the Vault for a client (OAuth or System User). Requires the caller's
 * session so RLS decides whether the client is visible.
 */
export const Route = createFileRoute("/api/meta-ads/discover")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization");
          if (!authHeader) return json({ error: "No autenticado" }, 401);
          const clientId = new URL(request.url).searchParams.get("clientId");
          if (!clientId) return json({ error: "clientId requerido" }, 400);
          // Spending the agency's Meta token requires an editor role (owner/admin/agent)
          // in the client's org; viewers and portal users are rejected.
          const denied = await denyUnlessClientEditor(authHeader, clientId);
          if (denied) return denied;

          const supa = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              global: { headers: { Authorization: authHeader } },
            },
          );
          const { data: visible } = await supa
            .from("meta_accounts")
            .select("id")
            .eq("client_id", clientId)
            .maybeSingle();
          if (!visible) return json({ error: "Cuenta no encontrada o sin permisos" }, 403);

          const { requireClientMetaToken } = await import("@/lib/meta/clientToken.server");
          const { token } = await requireClientMetaToken(clientId);
          const { discoverSystemUserAssets } = await import("@/lib/meta/systemUser.server");
          const assets = await discoverSystemUserAssets(token);

          return json({
            adAccounts: assets.adAccounts.map((a) => ({
              id: a.id,
              name: a.name,
              status: null,
              business: a.source,
            })),
            pages: assets.pages.map((p) => {
              const ig = assets.igAccounts.find((i) => i.page_id === p.id);
              return {
                id: p.id,
                name: p.name,
                business: "",
                instagram: ig ? { id: ig.id, username: ig.username, avatar: "" } : null,
              };
            }),
            instagramAccounts: assets.igAccounts.map((i) => ({
              id: i.id,
              username: i.username,
              avatar: "",
              source: i.source,
            })),
            base: graphBase(),
            warnings: assets.warnings,
          });
        } catch (e: any) {
          return json({ error: e?.message ?? "Error inesperado" }, 500);
        }
      },
    },
  },
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
