import { graphBase } from "@/lib/meta/version";
import { denyUnlessClientEditor } from "@/lib/auth/clientAccess.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Entity = "campaign" | "adset" | "ad";

export const Route = createFileRoute("/api/meta-ads/archive")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization");
          if (!authHeader) return j({ error: "No autenticado" }, 401);

          const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
            global: { headers: { Authorization: authHeader } },
          });

          const { entity, id } = (await request.json()) as { entity: Entity; id: string };
          if (!entity || !id) return j({ error: "Datos incompletos" }, 400);

          const tableMap = {
            campaign: { table: "meta_ads_campaigns", fk: "fb_campaign_id" },
            adset: { table: "meta_ads_adsets", fk: "fb_adset_id" },
            ad: { table: "meta_ads_ads", fk: "fb_ad_id" },
          } as const;
          const cfg = tableMap[entity];
          if (!cfg) return j({ error: "Entidad inválida" }, 400);

          const { data: row } = await supa.from(cfg.table).select("*").eq("id", id).maybeSingle();
          if (!row) return j({ error: "No encontrado" }, 404);
          // Spending the agency's Meta token requires an editor role (owner/admin/agent)
          // in the client's org; viewers and portal users are rejected.
          const denied = await denyUnlessClientEditor(authHeader, (row as any).client_id);
          if (denied) return denied;
          const fbId = (row as any)[cfg.fk];

          if (fbId) {
            const { requireClientMetaToken } = await import("@/lib/meta/clientToken.server");
            const { token } = await requireClientMetaToken((row as any).client_id);
            const params = new URLSearchParams({ status: "DELETED", access_token: token });
            const res = await fetch(`${graphBase()}/${fbId}`, { method: "POST", body: params });
            const body = await res.json();
            if (!res.ok) {
              const msg = body?.error?.error_user_msg ?? body?.error?.message ?? "Error Meta API";
              // Si Meta ya lo eliminó, continúa con el borrado local
              if (!/does not exist|already/i.test(msg)) {
                return j({ error: msg }, 502);
              }
            }
          }

          await supa.from(cfg.table).delete().eq("id", id);
          return j({ ok: true });
        } catch (e: any) {
          return j({ error: e?.message ?? "Error inesperado" }, 500);
        }
      },
    },
  },
});

function j(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
}
