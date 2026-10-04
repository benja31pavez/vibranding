import { graphBase } from "@/lib/meta/version";
import { denyUnlessClientEditor } from "@/lib/auth/clientAccess.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/meta-ads/create-campaign")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization");
          if (!authHeader) return json({ error: "No autenticado" }, 401);

          const supaUrl = process.env.SUPABASE_URL!;
          const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const userClient = createClient(supaUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
          });

          const { campaignId } = (await request.json()) as { campaignId?: string };
          if (!campaignId) return json({ error: "campaignId requerido" }, 400);

          const { data: c } = await userClient
            .from("meta_ads_campaigns").select("*").eq("id", campaignId).maybeSingle();
          if (!c) return json({ error: "Campaña no encontrada" }, 404);
          // Spending the agency's Meta token requires an editor role (owner/admin/agent)
          // in the client's org; viewers and portal users are rejected.
          const denied = await denyUnlessClientEditor(authHeader, c.client_id);
          if (denied) return denied;
          if (c.fb_campaign_id) return json({ error: "Esta campaña ya existe en Meta", fb_campaign_id: c.fb_campaign_id }, 400);

          const { data: acc } = await userClient
            .from("meta_accounts").select("ad_account_id").eq("client_id", c.client_id).maybeSingle();
          if (!acc?.ad_account_id) return json({ error: "Configura el ID de cuenta publicitaria" }, 400);

          const { requireClientMetaToken } = await import("@/lib/meta/clientToken.server");
          const { token } = await requireClientMetaToken(c.client_id);

          const adAcc = acc.ad_account_id.startsWith("act_") ? acc.ad_account_id : `act_${acc.ad_account_id}`;

          const params = new URLSearchParams({
            name: c.name,
            objective: c.objective,
            status: "PAUSED", // crear pausada por seguridad
            special_ad_categories: "[]",
            access_token: token,
          });
          if (c.daily_budget) params.set("daily_budget", String(Math.round(Number(c.daily_budget) * 100)));
          if (c.lifetime_budget) params.set("lifetime_budget", String(Math.round(Number(c.lifetime_budget) * 100)));

          const res = await fetch(`${graphBase()}/${adAcc}/campaigns`, {
            method: "POST",
            body: params,
          });
          const body = await res.json();
          if (!res.ok) return json({ error: body?.error?.error_user_msg ?? body?.error?.message ?? "Error Meta API" }, 502);

          await userClient.from("meta_ads_campaigns")
            .update({ fb_campaign_id: body.id, status: "PAUSED" })
            .eq("id", campaignId);

          return json({ ok: true, fb_campaign_id: body.id });
        } catch (e: any) {
          return json({ error: e?.message ?? "Error inesperado" }, 500);
        }
      },
    },
  },
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
