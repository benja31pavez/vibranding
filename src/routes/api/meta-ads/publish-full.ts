import { graphBase } from "@/lib/meta/version";
import { denyUnlessClientEditor } from "@/lib/auth/clientAccess.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  toMetaAmount,
  budgetConfirmationRequest,
  BUDGET_CONFIRMATION_REQUIRED,
  MetaCurrencyError,
} from "@/lib/meta/currency";
import { publishFullBodySchema, zodMessage } from "@/lib/meta-ads/apiSchemas";
import { resolveAdAccountCurrency } from "@/lib/meta/accountCurrency.server";

export const Route = createFileRoute("/api/meta-ads/publish-full")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization");
          if (!authHeader) return j({ error: "No autenticado" }, 401);

          const supa = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              global: { headers: { Authorization: authHeader } },
            },
          );

          const parsed = publishFullBodySchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) return j({ error: zodMessage(parsed.error) }, 400);
          const { clientId, campaign, adset, confirmedAmounts } = parsed.data;
          const ad = parsed.data.ad as any;
          // Spending the agency's Meta token requires an editor role (owner/admin/agent)
          // in the client's org; viewers and portal users are rejected.
          const denied = await denyUnlessClientEditor(authHeader, String(clientId));
          if (denied) return denied;

          // RLS check: the caller must be able to see this client's connection.
          const { data: acc } = await supa
            .from("meta_accounts")
            .select("*")
            .eq("client_id", clientId)
            .maybeSingle();
          if (!acc?.ad_account_id) return j({ error: "Configura la cuenta publicitaria" }, 400);

          // Token comes from the Vault for this client (OAuth or System User).
          const { requireClientMetaToken } = await import("@/lib/meta/clientToken.server");
          const { token } = await requireClientMetaToken(clientId);

          const adAcc = acc.ad_account_id.startsWith("act_")
            ? acc.ad_account_id
            : `act_${acc.ad_account_id}`;
          const base = graphBase();

          // Budgets go to Meta in minimum units per the account currency offset
          // (CLP = 1, USD = 100). Resolve and validate BEFORE creating anything.
          const currency = await resolveAdAccountCurrency(adAcc, token, acc.currency);
          // CBO: budget lives on the campaign; otherwise on the ad set. "inherit" sends none.
          const budgetOwner = campaign.cboEnabled ? campaign : adset;
          const budgetType = budgetOwner.budgetType;
          if (budgetType !== "inherit" && budgetOwner.budgetAmount == null) {
            return j({ error: "Indica el monto del presupuesto" }, 400);
          }
          const budgetAmount = budgetType === "inherit" ? null : (budgetOwner.budgetAmount ?? null);
          const dailyBudget = budgetType === "daily" ? budgetAmount : null;
          const lifetimeBudget = budgetType === "lifetime" ? budgetAmount : null;
          const spendCap = campaign.spendCap ?? null;
          const bidAmount = adset.bidAmount ?? null;
          const pending = budgetConfirmationRequest(
            { daily: dailyBudget, lifetime: lifetimeBudget, spendCap, bid: bidAmount },
            currency,
            confirmedAmounts,
          );
          if (pending) {
            return j(
              {
                error: pending.message,
                code: BUDGET_CONFIRMATION_REQUIRED,
                requiresConfirmation: pending.amounts,
              },
              409,
            );
          }
          // Convert (and validate: integers for CLP, no 0, <= 1e12) before creating anything in Meta.
          const metaMoney = (amount: number | null) =>
            amount == null ? null : String(toMetaAmount(amount, currency));
          const metaDaily = metaMoney(dailyBudget);
          const metaLifetime = metaMoney(lifetimeBudget);
          const metaSpendCap = metaMoney(spendCap);
          const metaBid = metaMoney(bidAmount);

          // 1) Image upload (if URL present)
          let imageHash: string | undefined;
          if (ad.format === "image" && ad.imageUrl) {
            const p = new URLSearchParams({ url: ad.imageUrl, access_token: token });
            const r = await fetch(`${base}/${adAcc}/adimages`, { method: "POST", body: p });
            const b = await r.json();
            if (!r.ok) return j({ error: `Imagen: ${b?.error?.message ?? "error"}` }, 502);
            const first = b.images && (Object.values(b.images)[0] as any);
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
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
            special_ad_categories: "[]",
            buying_type: "AUCTION",
            bid_strategy: campaign.bidStrategy,
            access_token: token,
          };
          if (campaign.cboEnabled) {
            if (metaDaily) campaignParams.daily_budget = metaDaily;
            if (metaLifetime) campaignParams.lifetime_budget = metaLifetime;
          }
          if (metaSpendCap) campaignParams.spend_cap = metaSpendCap;
          const cRes = await fetch(`${base}/${adAcc}/campaigns`, {
            method: "POST",
            body: new URLSearchParams(campaignParams),
          });
          const cBody = await cRes.json();
          if (!cRes.ok)
            return j(
              {
                error: `Campaña: ${cBody?.error?.error_user_msg ?? cBody?.error?.message ?? "error"}`,
              },
              502,
            );
          const fbCampaignId = cBody.id;

          // 4) Ad set
          const targeting: any = {
            geo_locations: { countries: adset.countries },
            age_min: adset.ageMin,
            age_max: adset.ageMax,
            genders: adset.gender === "male" ? [1] : adset.gender === "female" ? [2] : [1, 2],
          };
          if (adset.devicePlatforms.length) targeting.device_platforms = adset.devicePlatforms;
          if (adset.userOs.length) targeting.user_os = adset.userOs;
          if (adset.placementMode === "manual") {
            const pubs = new Set<string>();
            const fb: string[] = [],
              ig: string[] = [],
              an: string[] = [],
              msg: string[] = [];
            for (const p of adset.placements as string[]) {
              if (p.startsWith("facebook_")) {
                pubs.add("facebook");
                fb.push(p.replace("facebook_", ""));
              } else if (p.startsWith("instagram_")) {
                pubs.add("instagram");
                ig.push(p.replace("instagram_", ""));
              } else if (p.startsWith("audience_network_")) {
                pubs.add("audience_network");
                an.push(p.replace("audience_network_", ""));
              } else if (p.startsWith("messenger_")) {
                pubs.add("messenger");
                msg.push(p.replace("messenger_", ""));
              }
            }
            targeting.publisher_platforms = Array.from(pubs);
            if (fb.length) targeting.facebook_positions = fb;
            if (ig.length) targeting.instagram_positions = ig;
            if (an.length) targeting.audience_network_positions = an;
            if (msg.length) targeting.messenger_positions = msg;
          }
          const adsetParams: Record<string, string> = {
            name: adset.name,
            campaign_id: fbCampaignId,
            status: adset.status,
            optimization_goal: adset.optimizationGoal,
            billing_event: adset.billingEvent,
            targeting: JSON.stringify(targeting),
            access_token: token,
          };
          if (!campaign.cboEnabled) {
            if (metaDaily) adsetParams.daily_budget = metaDaily;
            if (metaLifetime) adsetParams.lifetime_budget = metaLifetime;
          }
          if (metaBid) adsetParams.bid_amount = metaBid;
          if (adset.startTime) adsetParams.start_time = new Date(adset.startTime).toISOString();
          else if (campaign.startTime)
            adsetParams.start_time = new Date(campaign.startTime).toISOString();
          if (adset.endTime) adsetParams.end_time = new Date(adset.endTime).toISOString();
          else if (campaign.endTime)
            adsetParams.end_time = new Date(campaign.endTime).toISOString();
          const aRes = await fetch(`${base}/${adAcc}/adsets`, {
            method: "POST",
            body: new URLSearchParams(adsetParams),
          });
          const aBody = await aRes.json();
          if (!aRes.ok)
            return j(
              {
                error: `Conjunto: ${aBody?.error?.error_user_msg ?? aBody?.error?.message ?? "error"}`,
                fb_campaign_id: fbCampaignId,
              },
              502,
            );
          const fbAdsetId = aBody.id;

          // 5) Creative
          const objectStory: any = { page_id: ad.pageId };
          if (ad.instagramActorId) objectStory.instagram_actor_id = ad.instagramActorId;
          const cta = { type: ad.cta, value: { link: ad.linkUrl } };
          if (ad.format === "image") {
            objectStory.link_data = {
              image_hash: imageHash,
              link: ad.linkUrl,
              message: ad.primaryText,
              name: ad.headline,
              description: ad.description,
              call_to_action: cta,
            };
          } else if (ad.format === "video") {
            objectStory.video_data = {
              video_id: videoId,
              message: ad.primaryText,
              title: ad.headline,
              call_to_action: cta,
            };
          } else if (ad.format === "carousel") {
            // upload card images first
            const child_attachments: any[] = [];
            for (const card of ad.carouselCards as any[]) {
              let h: string | undefined;
              if (card.image_url) {
                const p = new URLSearchParams({ url: card.image_url, access_token: token });
                const r = await fetch(`${base}/${adAcc}/adimages`, { method: "POST", body: p });
                const b = await r.json();
                const first = b.images && (Object.values(b.images)[0] as any);
                h = first?.hash;
              }
              child_attachments.push({
                image_hash: h,
                link: card.link_url,
                name: card.headline,
                description: card.description,
                call_to_action: { type: card.cta, value: { link: card.link_url } },
              });
            }
            objectStory.link_data = {
              link: ad.linkUrl,
              message: ad.primaryText,
              child_attachments,
              multi_share_optimized: ad.optimizeCarouselOrder,
              multi_share_end_card: ad.multiShareEndCard,
            };
          }
          const creativeRes = await fetch(`${base}/${adAcc}/adcreatives`, {
            method: "POST",
            body: new URLSearchParams({
              name: `${ad.name} creative`,
              object_story_spec: JSON.stringify(objectStory),
              access_token: token,
            }),
          });
          const creativeBody = await creativeRes.json();
          if (!creativeRes.ok)
            return j(
              {
                error: `Creativo: ${creativeBody?.error?.error_user_msg ?? creativeBody?.error?.message ?? "error"}`,
                fb_campaign_id: fbCampaignId,
              },
              502,
            );

          // 6) Ad
          const adRes = await fetch(`${base}/${adAcc}/ads`, {
            method: "POST",
            body: new URLSearchParams({
              name: ad.name,
              adset_id: fbAdsetId,
              creative: JSON.stringify({ creative_id: creativeBody.id }),
              status: ad.status,
              access_token: token,
            }),
          });
          const adBody = await adRes.json();
          if (!adRes.ok)
            return j(
              {
                error: `Anuncio: ${adBody?.error?.error_user_msg ?? adBody?.error?.message ?? "error"}`,
                fb_campaign_id: fbCampaignId,
              },
              502,
            );

          // 7) Persist to DB
          const { data: dbCampaign } = await supa
            .from("meta_ads_campaigns")
            .insert({
              client_id: clientId,
              meta_account_id: acc.id,
              fb_campaign_id: fbCampaignId,
              name: campaign.name,
              objective: campaign.objective,
              status: campaign.status,
              daily_budget: campaign.cboEnabled ? dailyBudget : null,
              lifetime_budget: campaign.cboEnabled ? lifetimeBudget : null,
              start_time: campaign.startTime?.slice(0, 10),
              stop_time: campaign.endTime?.slice(0, 10),
              spend_cap: campaign.spendCap,
              cbo_enabled: campaign.cboEnabled,
              currency,
              bid_strategy: campaign.bidStrategy,
              buying_type: "AUCTION",
            })
            .select()
            .single();
          const { data: dbAdset } = await supa
            .from("meta_ads_adsets")
            .insert({
              client_id: clientId,
              meta_account_id: acc.id,
              campaign_id: dbCampaign!.id,
              fb_adset_id: fbAdsetId,
              name: adset.name,
              status: adset.status,
              daily_budget: !campaign.cboEnabled ? dailyBudget : null,
              lifetime_budget: !campaign.cboEnabled ? lifetimeBudget : null,
              optimization_goal: adset.optimizationGoal,
              billing_event: adset.billingEvent,
              age_min: adset.ageMin,
              age_max: adset.ageMax,
              genders: adset.gender,
              countries: adset.countries.join(","),
              interests: adset.interests.join(","),
              placement_mode: adset.placementMode,
              placements: adset.placements,
            })
            .select()
            .single();
          await supa.from("meta_ads_ads").insert({
            client_id: clientId,
            meta_account_id: acc.id,
            adset_id: dbAdset!.id,
            fb_ad_id: adBody.id,
            fb_creative_id: creativeBody.id,
            name: ad.name,
            status: ad.status,
            format: ad.format,
            image_url: ad.imageUrl || null,
            video_url: ad.videoUrl || null,
            primary_text: ad.primaryText,
            headline: ad.headline,
            description: ad.description,
            link_url: ad.linkUrl,
            cta: ad.cta,
            page_id: ad.pageId,
            instagram_actor_id: ad.instagramActorId,
            carousel_cards: ad.carouselCards,
          });

          return j({ ok: true, fb_campaign_id: fbCampaignId, adAccountId: adAcc });
        } catch (e: any) {
          if (e instanceof MetaCurrencyError) return j({ error: e.message }, 400);
          return j({ error: e?.message ?? "Error inesperado" }, 500);
        }
      },
    },
  },
});

function j(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), {
    status: s,
    headers: { "Content-Type": "application/json" },
  });
}
