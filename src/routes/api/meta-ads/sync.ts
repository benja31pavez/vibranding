import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/meta-ads/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const token = process.env.META_ADS_ACCESS_TOKEN;
          if (!token) {
            return json({ error: "Falta configurar META_ADS_ACCESS_TOKEN. Agrega el token de Meta Marketing API en los secretos del proyecto." }, 400);
          }

          const authHeader = request.headers.get("Authorization");
          if (!authHeader) return json({ error: "No autenticado" }, 401);

          const supaUrl = process.env.SUPABASE_URL!;
          const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const userClient = createClient(supaUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
          });

          const { clientId } = (await request.json()) as { clientId?: string };
          if (!clientId) return json({ error: "clientId requerido" }, 400);

          // Verify ownership via RLS
          const { data: account, error: aerr } = await userClient
            .from("meta_ads_accounts").select("*").eq("client_id", clientId).maybeSingle();
          if (aerr || !account) return json({ error: "Cuenta no encontrada o sin permisos" }, 403);
          if (!account.ad_account_id) return json({ error: "Configura el ID de cuenta publicitaria" }, 400);

          const adAcc = account.ad_account_id.startsWith("act_") ? account.ad_account_id : `act_${account.ad_account_id}`;
          const fields = "id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time";
          const url = `https://graph.facebook.com/v21.0/${adAcc}/campaigns?fields=${fields}&limit=100&access_token=${encodeURIComponent(token)}`;
          const res = await fetch(url);
          const body = await res.json();
          if (!res.ok) return json({ error: body?.error?.message ?? "Error de Meta API" }, 502);

          const campaigns = (body.data ?? []) as any[];
          let imported = 0;
          for (const c of campaigns) {
            const objective = mapObjective(c.objective);
            const payload = {
              client_id: clientId,
              fb_campaign_id: c.id,
              name: c.name ?? "Campaña",
              objective,
              status: (c.status ?? "DRAFT") as string,
              daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
              lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
              start_time: c.start_time ? c.start_time.slice(0, 10) : null,
              stop_time: c.stop_time ? c.stop_time.slice(0, 10) : null,
            };
            const { data: existing } = await userClient
              .from("meta_ads_campaigns").select("id").eq("client_id", clientId).eq("fb_campaign_id", c.id).maybeSingle();
            if (existing) {
              await userClient.from("meta_ads_campaigns").update(payload).eq("id", existing.id);
            } else {
              await userClient.from("meta_ads_campaigns").insert(payload);
            }
            imported++;
          }

          await userClient.from("meta_ads_accounts").update({ last_synced_at: new Date().toISOString() }).eq("id", account.id);
          return json({ imported });
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

function mapObjective(o?: string): string {
  const allowed = ["OUTCOME_AWARENESS","OUTCOME_TRAFFIC","OUTCOME_ENGAGEMENT","OUTCOME_LEADS","OUTCOME_APP_PROMOTION","OUTCOME_SALES"];
  if (o && allowed.includes(o)) return o;
  const legacy: Record<string, string> = {
    BRAND_AWARENESS: "OUTCOME_AWARENESS", REACH: "OUTCOME_AWARENESS",
    LINK_CLICKS: "OUTCOME_TRAFFIC", TRAFFIC: "OUTCOME_TRAFFIC",
    POST_ENGAGEMENT: "OUTCOME_ENGAGEMENT", PAGE_LIKES: "OUTCOME_ENGAGEMENT", VIDEO_VIEWS: "OUTCOME_ENGAGEMENT",
    LEAD_GENERATION: "OUTCOME_LEADS", MESSAGES: "OUTCOME_LEADS",
    APP_INSTALLS: "OUTCOME_APP_PROMOTION",
    CONVERSIONS: "OUTCOME_SALES", CATALOG_SALES: "OUTCOME_SALES", PRODUCT_CATALOG_SALES: "OUTCOME_SALES",
  };
  return legacy[o ?? ""] ?? "OUTCOME_TRAFFIC";
}
