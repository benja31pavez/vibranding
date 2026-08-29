import { graphBase } from "@/lib/meta/version";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/meta-ads/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const token = process.env.META_ADS_ACCESS_TOKEN;
          if (!token) return json({ error: "Falta META_ADS_ACCESS_TOKEN" }, 400);
          const authHeader = request.headers.get("Authorization");
          if (!authHeader) return json({ error: "No autenticado" }, 401);

          const userClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
            global: { headers: { Authorization: authHeader } },
          });

          const { clientId } = (await request.json()) as { clientId?: string };
          if (!clientId) return json({ error: "clientId requerido" }, 400);

          const { data: account, error: aerr } = await userClient
            .from("meta_ads_accounts").select("*").eq("client_id", clientId).maybeSingle();
          if (aerr || !account) return json({ error: "Cuenta no encontrada o sin permisos" }, 403);
          if (!account.ad_account_id) return json({ error: "Configura la cuenta publicitaria" }, 400);

          const adAcc = account.ad_account_id.startsWith("act_") ? account.ad_account_id : `act_${account.ad_account_id}`;
          const tok = encodeURIComponent(token);
          const base = graphBase();

          // 1) Campaigns
          const cFields = "id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time,bid_strategy,spend_cap,buying_type";
          const cRes = await fetch(`${base}/${adAcc}/campaigns?fields=${cFields}&limit=200&access_token=${tok}`);
          const cBody = await cRes.json();
          if (!cRes.ok) return json({ error: cBody?.error?.message ?? "Error Meta API" }, 502);
          const campaigns = (cBody.data ?? []) as any[];

          let campaignsCount = 0, adsetsCount = 0, adsCount = 0, insightsCount = 0;
          const campaignIdByFb = new Map<string, string>();

          for (const c of campaigns) {
            const payload = {
              client_id: clientId, fb_campaign_id: c.id, name: c.name ?? "Campaña",
              objective: mapObjective(c.objective),
              status: (c.status ?? "DRAFT") as string,
              daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
              lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
              spend_cap: c.spend_cap ? Number(c.spend_cap) / 100 : null,
              bid_strategy: c.bid_strategy ?? null,
              buying_type: c.buying_type ?? "AUCTION",
              start_time: c.start_time ? c.start_time.slice(0, 10) : null,
              stop_time: c.stop_time ? c.stop_time.slice(0, 10) : null,
            };
            const { data: existing } = await userClient
              .from("meta_ads_campaigns").select("id").eq("client_id", clientId).eq("fb_campaign_id", c.id).maybeSingle();
            let localId: string;
            if (existing) {
              await userClient.from("meta_ads_campaigns").update(payload).eq("id", existing.id);
              localId = existing.id;
            } else {
              const { data: ins } = await userClient.from("meta_ads_campaigns").insert(payload).select("id").single();
              localId = ins!.id;
            }
            campaignIdByFb.set(c.id, localId);
            campaignsCount++;
          }

          // 2) AdSets
          if (campaigns.length) {
            const asFields = "id,name,status,campaign_id,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,start_time,end_time,targeting";
            const asRes = await fetch(`${base}/${adAcc}/adsets?fields=${asFields}&limit=500&access_token=${tok}`);
            const asBody = await asRes.json();
            if (asRes.ok) {
              for (const a of (asBody.data ?? []) as any[]) {
                const campLocal = campaignIdByFb.get(a.campaign_id);
                if (!campLocal) continue;
                const t = a.targeting ?? {};
                const placements: string[] = [];
                for (const p of t.facebook_positions ?? []) placements.push(`facebook_${p}`);
                for (const p of t.instagram_positions ?? []) placements.push(`instagram_${p}`);
                for (const p of t.audience_network_positions ?? []) placements.push(`audience_network_${p}`);
                for (const p of t.messenger_positions ?? []) placements.push(`messenger_${p}`);
                const gender = t.genders?.length === 1 ? (t.genders[0] === 1 ? "male" : "female") : "all";
                const payload = {
                  client_id: clientId, campaign_id: campLocal, fb_adset_id: a.id,
                  name: a.name ?? "Conjunto", status: a.status ?? "DRAFT",
                  daily_budget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
                  lifetime_budget: a.lifetime_budget ? Number(a.lifetime_budget) / 100 : null,
                  optimization_goal: a.optimization_goal ?? null,
                  billing_event: a.billing_event ?? null,
                  bid_amount: a.bid_amount ? Number(a.bid_amount) / 100 : null,
                  start_time: a.start_time ?? null, end_time: a.end_time ?? null,
                  age_min: t.age_min ?? null, age_max: t.age_max ?? null,
                  genders: gender, countries: (t.geo_locations?.countries ?? []).join(","),
                  placements, placement_mode: placements.length ? "manual" : "automatic",
                  device_platforms: t.device_platforms ?? [],
                };
                const { data: existing } = await userClient
                  .from("meta_ads_adsets").select("id").eq("client_id", clientId).eq("fb_adset_id", a.id).maybeSingle();
                if (existing) await userClient.from("meta_ads_adsets").update(payload).eq("id", existing.id);
                else await userClient.from("meta_ads_adsets").insert(payload);
                adsetsCount++;
              }
            }
          }

          // 3) Ads
          const { data: localAdsets } = await userClient
            .from("meta_ads_adsets").select("id,fb_adset_id").eq("client_id", clientId);
          const adsetIdByFb = new Map<string, string>();
          for (const a of localAdsets ?? []) if (a.fb_adset_id) adsetIdByFb.set(a.fb_adset_id, a.id);

          if (adsetIdByFb.size) {
            const adFields = "id,name,status,adset_id,creative{id,object_story_spec,thumbnail_url,image_url,video_id,effective_object_story_id}";
            const adRes = await fetch(`${base}/${adAcc}/ads?fields=${adFields}&limit=500&access_token=${tok}`);
            const adBody = await adRes.json();
            if (adRes.ok) {
              for (const ad of (adBody.data ?? []) as any[]) {
                const local = adsetIdByFb.get(ad.adset_id);
                if (!local) continue;
                const cr = ad.creative ?? {};
                const story = cr.object_story_spec ?? {};
                const link = story.link_data ?? story.video_data ?? {};
                const payload = {
                  client_id: clientId, adset_id: local, fb_ad_id: ad.id,
                  fb_creative_id: cr.id ?? null,
                  name: ad.name ?? "Anuncio", status: ad.status ?? "DRAFT",
                  format: story.video_data ? "video" : story.link_data?.child_attachments ? "carousel" : "image",
                  image_url: cr.image_url ?? null,
                  primary_text: link.message ?? null,
                  headline: link.name ?? link.title ?? null,
                  description: link.description ?? null,
                  link_url: link.link ?? null,
                  cta: link.call_to_action?.type ?? null,
                  page_id: story.page_id ?? null,
                  instagram_actor_id: story.instagram_actor_id ?? null,
                };
                const { data: existing } = await userClient
                  .from("meta_ads_ads").select("id").eq("client_id", clientId).eq("fb_ad_id", ad.id).maybeSingle();
                if (existing) await userClient.from("meta_ads_ads").update(payload).eq("id", existing.id);
                else await userClient.from("meta_ads_ads").insert(payload);
                adsCount++;
              }
            }
          }

          // 4) Insights (últimos 30 días) por campaña
          const inFields = "impressions,reach,clicks,ctr,spend,cpc,cpm,date_start,date_stop";
          for (const c of campaigns) {
            const localId = campaignIdByFb.get(c.id);
            if (!localId) continue;
            const iRes = await fetch(`${base}/${c.id}/insights?fields=${inFields}&date_preset=last_30d&access_token=${tok}`);
            const iBody = await iRes.json();
            if (!iRes.ok) continue;
            for (const i of (iBody.data ?? []) as any[]) {
              const payload = {
                client_id: clientId, campaign_id: localId,
                date_start: i.date_start ?? null, date_stop: i.date_stop ?? null,
                impressions: Number(i.impressions ?? 0), reach: Number(i.reach ?? 0),
                clicks: Number(i.clicks ?? 0), ctr: i.ctr ? Number(i.ctr) : null,
                spend: Number(i.spend ?? 0), cpc: i.cpc ? Number(i.cpc) : null,
                cpm: i.cpm ? Number(i.cpm) : null,
              };
              const { data: existing } = await userClient
                .from("meta_ads_insights").select("id").eq("client_id", clientId).eq("campaign_id", localId)
                .eq("date_start", payload.date_start).eq("date_stop", payload.date_stop).maybeSingle();
              if (existing) await userClient.from("meta_ads_insights").update(payload).eq("id", existing.id);
              else await userClient.from("meta_ads_insights").insert(payload);
              insightsCount++;
            }
          }

          await userClient.from("meta_ads_accounts").update({ last_synced_at: new Date().toISOString() }).eq("id", account.id);
          return json({ campaigns: campaignsCount, adsets: adsetsCount, ads: adsCount, insights: insightsCount });
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
