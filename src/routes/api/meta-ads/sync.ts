import { graphBase } from "@/lib/meta/version";
import { denyUnlessClientEditor } from "@/lib/auth/clientAccess.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  fromMetaAmountOrNull,
  getMetaCurrencyOffset,
  MetaCurrencyError,
} from "@/lib/meta/currency";
import { fetchLiveAdAccountCurrency } from "@/lib/meta/accountCurrency.server";

export const Route = createFileRoute("/api/meta-ads/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization");
          if (!authHeader) return json({ error: "No autenticado" }, 401);

          const userClient = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              global: { headers: { Authorization: authHeader } },
            },
          );

          const { clientId } = (await request.json()) as { clientId?: string };
          if (!clientId) return json({ error: "clientId requerido" }, 400);
          // Spending the agency's Meta token requires an editor role (owner/admin/agent)
          // in the client's org; viewers and portal users are rejected.
          const denied = await denyUnlessClientEditor(authHeader, clientId);
          if (denied) return denied;

          const { data: account, error: aerr } = await userClient
            .from("meta_accounts")
            .select("*")
            .eq("client_id", clientId)
            .maybeSingle();
          if (aerr || !account) return json({ error: "Cuenta no encontrada o sin permisos" }, 403);
          if (!account.ad_account_id)
            return json({ error: "Configura la cuenta publicitaria" }, 400);

          const { requireClientMetaToken } = await import("@/lib/meta/clientToken.server");
          const { token } = await requireClientMetaToken(clientId);

          const adAcc = account.ad_account_id.startsWith("act_")
            ? account.ad_account_id
            : `act_${account.ad_account_id}`;
          const tok = encodeURIComponent(token);
          const base = graphBase();
          // Budgets come back in minimum units per the account currency offset.
          // Keep meta_accounts.currency in sync with Meta's live value.
          const cached = account.currency ? String(account.currency).trim().toUpperCase() : null;
          const live = await fetchLiveAdAccountCurrency(adAcc, token);
          if (live && live !== cached) {
            if (cached) console.warn(`[meta-sync] moneda de ${adAcc} cambió: ${cached} -> ${live}`);
            const { error: curErr } = await userClient
              .from("meta_accounts")
              .update({ currency: live })
              .eq("id", account.id);
            if (curErr) console.error("[meta-sync] no se pudo guardar la moneda", curErr.message);
          }
          const currency = live ?? cached;
          // Unknown currency/offset: sync everything except money fields (left untouched).
          let moneyWarning: string | null = null;
          try {
            getMetaCurrencyOffset(currency);
          } catch (e) {
            moneyWarning = e instanceof MetaCurrencyError ? e.message : "Moneda desconocida";
            console.warn(`[meta-sync] ${adAcc}: se omiten presupuestos: ${moneyWarning}`);
          }
          const moneyFields = (
            fields: Record<string, unknown>,
          ): Record<string, number | null | string> => {
            if (moneyWarning || !currency) return {};
            const out: Record<string, number | null | string> = { currency };
            for (const [k, v] of Object.entries(fields)) {
              out[k] = fromMetaAmountOrNull(v as string | number | null | undefined, currency);
            }
            return out;
          };

          // 1) Campaigns
          const cFields =
            "id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time,bid_strategy,spend_cap,buying_type";
          const cRes = await fetch(
            `${base}/${adAcc}/campaigns?fields=${cFields}&limit=200&access_token=${tok}`,
          );
          const cBody = await cRes.json();
          if (!cRes.ok) return json({ error: cBody?.error?.message ?? "Error Meta API" }, 502);
          const campaigns = (cBody.data ?? []) as any[];

          let campaignsCount = 0,
            adsetsCount = 0,
            adsCount = 0;
          const campaignIdByFb = new Map<string, string>();

          for (const c of campaigns) {
            const payload = {
              client_id: clientId,
              meta_account_id: account.id,
              fb_campaign_id: c.id,
              name: c.name ?? "Campaña",
              objective: mapObjective(c.objective),
              status: (c.status ?? "DRAFT") as string,
              ...moneyFields({
                daily_budget: c.daily_budget,
                lifetime_budget: c.lifetime_budget,
                spend_cap: c.spend_cap,
              }),
              bid_strategy: c.bid_strategy ?? null,
              buying_type: c.buying_type ?? "AUCTION",
              start_time: c.start_time ? c.start_time.slice(0, 10) : null,
              stop_time: c.stop_time ? c.stop_time.slice(0, 10) : null,
            };
            const { data: existing } = await userClient
              .from("meta_ads_campaigns")
              .select("id")
              .eq("client_id", clientId)
              .eq("fb_campaign_id", c.id)
              .maybeSingle();
            let localId: string;
            if (existing) {
              await userClient.from("meta_ads_campaigns").update(payload).eq("id", existing.id);
              localId = existing.id;
            } else {
              const { data: ins } = await userClient
                .from("meta_ads_campaigns")
                .insert(payload)
                .select("id")
                .single();
              localId = ins!.id;
            }
            campaignIdByFb.set(c.id, localId);
            campaignsCount++;
          }

          // 2) AdSets
          if (campaigns.length) {
            const asFields =
              "id,name,status,campaign_id,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,start_time,end_time,targeting";
            const asRes = await fetch(
              `${base}/${adAcc}/adsets?fields=${asFields}&limit=500&access_token=${tok}`,
            );
            const asBody = await asRes.json();
            if (asRes.ok) {
              for (const a of (asBody.data ?? []) as any[]) {
                const campLocal = campaignIdByFb.get(a.campaign_id);
                if (!campLocal) continue;
                const t = a.targeting ?? {};
                const placements: string[] = [];
                for (const p of t.facebook_positions ?? []) placements.push(`facebook_${p}`);
                for (const p of t.instagram_positions ?? []) placements.push(`instagram_${p}`);
                for (const p of t.audience_network_positions ?? [])
                  placements.push(`audience_network_${p}`);
                for (const p of t.messenger_positions ?? []) placements.push(`messenger_${p}`);
                const gender =
                  t.genders?.length === 1 ? (t.genders[0] === 1 ? "male" : "female") : "all";
                const payload = {
                  client_id: clientId,
                  meta_account_id: account.id,
                  campaign_id: campLocal,
                  fb_adset_id: a.id,
                  name: a.name ?? "Conjunto",
                  status: a.status ?? "DRAFT",
                  ...stripCurrency(
                    moneyFields({
                      daily_budget: a.daily_budget,
                      lifetime_budget: a.lifetime_budget,
                      bid_amount: a.bid_amount,
                    }),
                  ),
                  optimization_goal: a.optimization_goal ?? null,
                  billing_event: a.billing_event ?? null,
                  start_time: a.start_time ?? null,
                  end_time: a.end_time ?? null,
                  age_min: t.age_min ?? null,
                  age_max: t.age_max ?? null,
                  genders: gender,
                  countries: (t.geo_locations?.countries ?? []).join(","),
                  placements,
                  placement_mode: placements.length ? "manual" : "automatic",
                  device_platforms: t.device_platforms ?? [],
                };
                const { data: existing } = await userClient
                  .from("meta_ads_adsets")
                  .select("id")
                  .eq("client_id", clientId)
                  .eq("fb_adset_id", a.id)
                  .maybeSingle();
                if (existing)
                  await userClient.from("meta_ads_adsets").update(payload).eq("id", existing.id);
                else await userClient.from("meta_ads_adsets").insert(payload);
                adsetsCount++;
              }
            }
          }

          // 3) Ads
          const { data: localAdsets } = await userClient
            .from("meta_ads_adsets")
            .select("id,fb_adset_id")
            .eq("client_id", clientId);
          const adsetIdByFb = new Map<string, string>();
          for (const a of localAdsets ?? [])
            if (a.fb_adset_id) adsetIdByFb.set(a.fb_adset_id, a.id);

          if (adsetIdByFb.size) {
            const adFields =
              "id,name,status,adset_id,creative{id,object_story_spec,thumbnail_url,image_url,video_id,effective_object_story_id}";
            const adRes = await fetch(
              `${base}/${adAcc}/ads?fields=${adFields}&limit=500&access_token=${tok}`,
            );
            const adBody = await adRes.json();
            if (adRes.ok) {
              for (const ad of (adBody.data ?? []) as any[]) {
                const local = adsetIdByFb.get(ad.adset_id);
                if (!local) continue;
                const cr = ad.creative ?? {};
                const story = cr.object_story_spec ?? {};
                const link = story.link_data ?? story.video_data ?? {};
                const payload = {
                  client_id: clientId,
                  meta_account_id: account.id,
                  adset_id: local,
                  fb_ad_id: ad.id,
                  fb_creative_id: cr.id ?? null,
                  name: ad.name ?? "Anuncio",
                  status: ad.status ?? "DRAFT",
                  format: story.video_data
                    ? "video"
                    : story.link_data?.child_attachments
                      ? "carousel"
                      : "image",
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
                  .from("meta_ads_ads")
                  .select("id")
                  .eq("client_id", clientId)
                  .eq("fb_ad_id", ad.id)
                  .maybeSingle();
                if (existing)
                  await userClient.from("meta_ads_ads").update(payload).eq("id", existing.id);
                else await userClient.from("meta_ads_ads").insert(payload);
                adsCount++;
              }
            }
          }

          await userClient
            .from("meta_accounts")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", account.id);
          return json({
            campaigns: campaignsCount,
            adsets: adsetsCount,
            ads: adsCount,
            ...(moneyWarning ? { warning: `Presupuestos no sincronizados: ${moneyWarning}` } : {}),
          });
        } catch (e: any) {
          if (e instanceof MetaCurrencyError) return json({ error: e.message }, 400);
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

/** Ad sets have no currency column; drop it from the money fields. */
function stripCurrency<T extends Record<string, unknown>>(fields: T): Omit<T, "currency"> {
  const { currency: _currency, ...rest } = fields;
  return rest;
}

function mapObjective(o?: string): string {
  const allowed = [
    "OUTCOME_AWARENESS",
    "OUTCOME_TRAFFIC",
    "OUTCOME_ENGAGEMENT",
    "OUTCOME_LEADS",
    "OUTCOME_APP_PROMOTION",
    "OUTCOME_SALES",
  ];
  if (o && allowed.includes(o)) return o;
  const legacy: Record<string, string> = {
    BRAND_AWARENESS: "OUTCOME_AWARENESS",
    REACH: "OUTCOME_AWARENESS",
    LINK_CLICKS: "OUTCOME_TRAFFIC",
    TRAFFIC: "OUTCOME_TRAFFIC",
    POST_ENGAGEMENT: "OUTCOME_ENGAGEMENT",
    PAGE_LIKES: "OUTCOME_ENGAGEMENT",
    VIDEO_VIEWS: "OUTCOME_ENGAGEMENT",
    LEAD_GENERATION: "OUTCOME_LEADS",
    MESSAGES: "OUTCOME_LEADS",
    APP_INSTALLS: "OUTCOME_APP_PROMOTION",
    CONVERSIONS: "OUTCOME_SALES",
    CATALOG_SALES: "OUTCOME_SALES",
    PRODUCT_CATALOG_SALES: "OUTCOME_SALES",
  };
  return legacy[o ?? ""] ?? "OUTCOME_TRAFFIC";
}
