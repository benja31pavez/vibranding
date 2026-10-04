import { graphBase } from "@/lib/meta/version";
import { denyUnlessClientEditor } from "@/lib/auth/clientAccess.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/meta-ads/publish-full")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization");
          if (!authHeader) return j({ error: "No autenticado" }, 401);

          const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
            global: { headers: { Authorization: authHeader } },
          });

          const { clientId, campaign, adset, ad } = (await request.json()) as any;
          if (!clientId || !campaign || !adset || !ad) return j({ error: "Datos incompletos" }, 400);
          // Spending the agency's Meta token requires an editor role (owner/admin/agent)
          // in the client's org; viewers and portal users are rejected.
          const denied = await denyUnlessClientEditor(authHeader, String(clientId));
          if (denied) return denied;

          // RLS check: the caller must be able to see this client's connection.
          const { data: acc } = await supa.from("meta_accounts").select("*").eq("client_id", clientId).maybeSingle();
          if (!acc?.ad_account_id) return j({ error: "Configura la cuenta publicitaria" }, 400);

          // Token comes from the Vault for this client (OAuth or System User).
          const { requireClientMetaToken } = await import("@/lib/meta/clientToken.server");
          const { token } = await requireClientMetaToken(clientId);

          const adAcc = acc.ad_account_id.startsWith("act_") ? acc.ad_account_id : `act_${acc.ad_account_id}`;
          const base = graphBase();

          // 1) Image upload (if URL present)
          let imageHash: string | undefined;
          if (ad.format === "image" && ad.imageUrl) {
            const p = new URLSearchParams({ url: ad.imageUrl, access_token: token });
            const r = await fetch(`${base}/${adAcc}/adimages`, { method: "POST", body: p });
            const b = await r.json();
            if (!r.ok) return j({ error: `Imagen: ${b?.error?.message ?? "error"}` }, 502);
            const first = b.images && Object.values(b.images)[0] as any;
            imageHash = first?.hash;
          }

          // 2) Video upload (file_url)
          let videoId: string | undefined;
          if (ad.format === "video" && ad.videoUrl) {
            const p = new URLSearchParams({ file_url: ad.videoUrl, access_token: token });
            const r = await fetch(`${base}/${adAcc}/advideos`, { method: "POST", body: p });
            const b = await r.json();
            if (!r.ok) return j({ error: `Video: ${b?.error?.message ?? "error"}` }, 502);
            videoId = b.id;
          }

          // 3) Campaign
          const campaignParams: Record<string, string> = {
            name: campaign.name, objective: campaign.objective, status: campaign.status,
            special_ad_categories: "[]", buying_type: "AUCTION", bid_strategy: campaign.bidStrategy,
            access_token: token,
          };
          if (campaign.cboEnabled) {
            if (campaign.budgetType === "daily") campaignParams.daily_budget = String(Math.round(campaign.budgetAmount * 100));
            else campaignParams.lifetime_budget = String(Math.round(campaign.budgetAmount * 100));
          }
          if (campaign.spendCap) campaignParams.spend_cap = String(Math.round(campaign.spendCap * 100));
          const cRes = await fetch(`${base}/${adAcc}/campaigns`, { method: "POST", body: new URLSearchParams(campaignParams) });
          const cBody = await cRes.json();
          if (!cRes.ok) return j({ error: `Campaña: ${cBody?.error?.error_user_msg ?? cBody?.error?.message ?? "error"}` }, 502);
          const fbCampaignId = cBody.id;

          // 4) Ad set
          const targeting: any = {
            geo_locations: { countries: adset.countries },
            age_min: adset.ageMin, age_max: adset.ageMax,
            genders: adset.gender === "male" ? [1] : adset.gender === "female" ? [2] : [1, 2],
          };
          if (adset.devicePlatforms.length) targeting.device_platforms = adset.devicePlatforms;
          if (adset.userOs.length) targeting.user_os = adset.userOs;
          if (adset.placementMode === "manual") {
            const pubs = new Set<string>();
            const fb: string[] = [], ig: string[] = [], an: string[] = [], msg: string[] = [];
            for (const p of adset.placements as string[]) {
              if (p.startsWith("facebook_")) { pubs.add("facebook"); fb.push(p.replace("facebook_", "")); }
              else if (p.startsWith("instagram_")) { pubs.add("instagram"); ig.push(p.replace("instagram_", "")); }
              else if (p.startsWith("audience_network_")) { pubs.add("audience_network"); an.push(p.replace("audience_network_", "")); }
              else if (p.startsWith("messenger_")) { pubs.add("messenger"); msg.push(p.replace("messenger_", "")); }
            }
            targeting.publisher_platforms = Array.from(pubs);
            if (fb.length) targeting.facebook_positions = fb;
            if (ig.length) targeting.instagram_positions = ig;
            if (an.length) targeting.audience_network_positions = an;
            if (msg.length) targeting.messenger_positions = msg;
          }
          const adsetParams: Record<string, string> = {
            name: adset.name, campaign_id: fbCampaignId, status: adset.status,
            optimization_goal: adset.optimizationGoal, billing_event: adset.billingEvent,
            targeting: JSON.stringify(targeting), access_token: token,
          };
          if (!campaign.cboEnabled && adset.budgetAmount) {
            if (adset.budgetType === "daily") adsetParams.daily_budget = String(Math.round(adset.budgetAmount * 100));
            else adsetParams.lifetime_budget = String(Math.round(adset.budgetAmount * 100));
          }
          if (adset.bidAmount) adsetParams.bid_amount = String(Math.round(adset.bidAmount * 100));
          if (adset.startTime) adsetParams.start_time = new Date(adset.startTime).toISOString();
          else if (campaign.startTime) adsetParams.start_time = new Date(campaign.startTime).toISOString();
          if (adset.endTime) adsetParams.end_time = new Date(adset.endTime).toISOString();
          else if (campaign.endTime) adsetParams.end_time = new Date(campaign.endTime).toISOString();
          const aRes = await fetch(`${base}/${adAcc}/adsets`, { method: "POST", body: new URLSearchParams(adsetParams) });
          const aBody = await aRes.json();
          if (!aRes.ok) return j({ error: `Conjunto: ${aBody?.error?.error_user_msg ?? aBody?.error?.message ?? "error"}`, fb_campaign_id: fbCampaignId }, 502);
          const fbAdsetId = aBody.id;

          // 5) Creative
          const objectStory: any = { page_id: ad.pageId };
          if (ad.instagramActorId) objectStory.instagram_actor_id = ad.instagramActorId;
          const cta = { type: ad.cta, value: { link: ad.linkUrl } };
          if (ad.format === "image") {
            objectStory.link_data = { image_hash: imageHash, link: ad.linkUrl, message: ad.primaryText, name: ad.headline, description: ad.description, call_to_action: cta };
          } else if (ad.format === "video") {
            objectStory.video_data = { video_id: videoId, message: ad.primaryText, title: ad.headline, call_to_action: cta };
          } else if (ad.format === "carousel") {
            // upload card images first
            const child_attachments: any[] = [];
            for (const card of ad.carouselCards as any[]) {
              let h: string | undefined;
              if (card.image_url) {
                const p = new URLSearchParams({ url: card.image_url, access_token: token });
                const r = await fetch(`${base}/${adAcc}/adimages`, { method: "POST", body: p });
                const b = await r.json();
                const first = b.images && Object.values(b.images)[0] as any;
                h = first?.hash;
              }
              child_attachments.push({
                image_hash: h, link: card.link_url, name: card.headline, description: card.description,
                call_to_action: { type: card.cta, value: { link: card.link_url } },
              });
            }
            objectStory.link_data = {
              link: ad.linkUrl, message: ad.primaryText, child_attachments,
              multi_share_optimized: ad.optimizeCarouselOrder, multi_share_end_card: ad.multiShareEndCard,
            };
          }
          const creativeRes = await fetch(`${base}/${adAcc}/adcreatives`, {
            method: "POST",
            body: new URLSearchParams({ name: `${ad.name} creative`, object_story_spec: JSON.stringify(objectStory), access_token: token }),
          });
          const creativeBody = await creativeRes.json();
          if (!creativeRes.ok) return j({ error: `Creativo: ${creativeBody?.error?.error_user_msg ?? creativeBody?.error?.message ?? "error"}`, fb_campaign_id: fbCampaignId }, 502);

          // 6) Ad
          const adRes = await fetch(`${base}/${adAcc}/ads`, {
            method: "POST",
            body: new URLSearchParams({
              name: ad.name, adset_id: fbAdsetId, creative: JSON.stringify({ creative_id: creativeBody.id }),
              status: ad.status, access_token: token,
            }),
          });
          const adBody = await adRes.json();
          if (!adRes.ok) return j({ error: `Anuncio: ${adBody?.error?.error_user_msg ?? adBody?.error?.message ?? "error"}`, fb_campaign_id: fbCampaignId }, 502);

          // 7) Persist to DB
          const { data: dbCampaign } = await supa.from("meta_ads_campaigns").insert({
            client_id: clientId, meta_account_id: acc.id, fb_campaign_id: fbCampaignId, name: campaign.name, objective: campaign.objective,
            status: campaign.status, daily_budget: campaign.cboEnabled && campaign.budgetType === "daily" ? campaign.budgetAmount : null,
            lifetime_budget: campaign.cboEnabled && campaign.budgetType === "lifetime" ? campaign.budgetAmount : null,
            start_time: campaign.startTime?.slice(0, 10), stop_time: campaign.endTime?.slice(0, 10),
            spend_cap: campaign.spendCap, cbo_enabled: campaign.cboEnabled,
            bid_strategy: campaign.bidStrategy, buying_type: "AUCTION",
          }).select().single();
          const { data: dbAdset } = await supa.from("meta_ads_adsets").insert({
            client_id: clientId, meta_account_id: acc.id, campaign_id: dbCampaign!.id, fb_adset_id: fbAdsetId,
            name: adset.name, status: adset.status,
            daily_budget: !campaign.cboEnabled && adset.budgetType === "daily" ? adset.budgetAmount : null,
            lifetime_budget: !campaign.cboEnabled && adset.budgetType === "lifetime" ? adset.budgetAmount : null,
            optimization_goal: adset.optimizationGoal, billing_event: adset.billingEvent,
            age_min: adset.ageMin, age_max: adset.ageMax, genders: adset.gender,
            countries: adset.countries.join(","), interests: adset.interests.join(","),
            placement_mode: adset.placementMode, placements: adset.placements,
          }).select().single();
          await supa.from("meta_ads_ads").insert({
            client_id: clientId, meta_account_id: acc.id, adset_id: dbAdset!.id, fb_ad_id: adBody.id, fb_creative_id: creativeBody.id,
            name: ad.name, status: ad.status, format: ad.format,
            image_url: ad.imageUrl || null, video_url: ad.videoUrl || null,
            primary_text: ad.primaryText, headline: ad.headline, description: ad.description,
            link_url: ad.linkUrl, cta: ad.cta, page_id: ad.pageId, instagram_actor_id: ad.instagramActorId,
            carousel_cards: ad.carouselCards,
          });

          return j({ ok: true, fb_campaign_id: fbCampaignId, adAccountId: adAcc });
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
