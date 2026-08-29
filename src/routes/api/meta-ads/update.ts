import { graphBase } from "@/lib/meta/version";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Entity = "campaign" | "adset" | "ad";

export const Route = createFileRoute("/api/meta-ads/update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("Authorization");
          if (!authHeader) return j({ error: "No autenticado" }, 401);

          const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
            global: { headers: { Authorization: authHeader } },
          });

          const { entity, id, patch } = (await request.json()) as { entity: Entity; id: string; patch: Record<string, any> };
          if (!entity || !id) return j({ error: "Datos incompletos" }, 400);

          const base = graphBase();
          const params = new URLSearchParams({ access_token: token });
          let fbId: string | null = null;

          if (entity === "campaign") {
            const { data: row } = await supa.from("meta_ads_campaigns").select("*").eq("id", id).maybeSingle();
            if (!row) return j({ error: "Campaña no encontrada" }, 404);
            fbId = row.fb_campaign_id;
            if (!fbId) return j({ ok: true, skipped: "local-only" });
            if (patch.name) params.set("name", patch.name);
            if (patch.status) params.set("status", patch.status);
            if (patch.objective) params.set("objective", patch.objective);
            if (patch.daily_budget != null) params.set("daily_budget", String(Math.round(Number(patch.daily_budget) * 100)));
            if (patch.lifetime_budget != null) params.set("lifetime_budget", String(Math.round(Number(patch.lifetime_budget) * 100)));
            if (patch.spend_cap != null) params.set("spend_cap", String(Math.round(Number(patch.spend_cap) * 100)));
            if (patch.bid_strategy) params.set("bid_strategy", patch.bid_strategy);
          } else if (entity === "adset") {
            const { data: row } = await supa.from("meta_ads_adsets").select("*").eq("id", id).maybeSingle();
            if (!row) return j({ error: "Conjunto no encontrado" }, 404);
            fbId = row.fb_adset_id;
            if (!fbId) return j({ ok: true, skipped: "local-only" });
            if (patch.name) params.set("name", patch.name);
            if (patch.status) params.set("status", patch.status);
            if (patch.daily_budget != null) params.set("daily_budget", String(Math.round(Number(patch.daily_budget) * 100)));
            if (patch.lifetime_budget != null) params.set("lifetime_budget", String(Math.round(Number(patch.lifetime_budget) * 100)));
            if (patch.optimization_goal) params.set("optimization_goal", patch.optimization_goal);
            if (patch.billing_event) params.set("billing_event", patch.billing_event);
            if (patch.bid_amount != null) params.set("bid_amount", String(Math.round(Number(patch.bid_amount) * 100)));
            if (patch.start_time) params.set("start_time", new Date(patch.start_time).toISOString());
            if (patch.end_time) params.set("end_time", new Date(patch.end_time).toISOString());
            // Targeting rebuild si vienen campos de segmentación
            if (
              patch.age_min != null || patch.age_max != null || patch.genders !== undefined ||
              patch.countries !== undefined || patch.placements !== undefined ||
              patch.placement_mode !== undefined || patch.device_platforms !== undefined
            ) {
              const merged = { ...row, ...patch };
              const targeting: any = {};
              const countries = String(merged.countries ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
              if (countries.length) targeting.geo_locations = { countries };
              if (merged.age_min) targeting.age_min = Number(merged.age_min);
              if (merged.age_max) targeting.age_max = Number(merged.age_max);
              const g = merged.genders;
              if (g === "male") targeting.genders = [1];
              else if (g === "female") targeting.genders = [2];
              if (merged.device_platforms?.length) targeting.device_platforms = merged.device_platforms;
              if (merged.placement_mode === "manual" && merged.placements?.length) {
                const fb: string[] = [], ig: string[] = [], an: string[] = [], msg: string[] = [];
                const pubs = new Set<string>();
                for (const p of merged.placements as string[]) {
                  if (p.startsWith("facebook_")) { pubs.add("facebook"); fb.push(p.replace("facebook_", "")); }
                  else if (p.startsWith("instagram_")) { pubs.add("instagram"); ig.push(p.replace("instagram_", "")); }
                  else if (p.startsWith("audience_network_")) { pubs.add("audience_network"); an.push(p.replace("audience_network_", "")); }
                  else if (p.startsWith("messenger_")) { pubs.add("messenger"); msg.push(p.replace("messenger_", "")); }
                  else pubs.add(p);
                }
                targeting.publisher_platforms = Array.from(pubs);
                if (fb.length) targeting.facebook_positions = fb;
                if (ig.length) targeting.instagram_positions = ig;
                if (an.length) targeting.audience_network_positions = an;
                if (msg.length) targeting.messenger_positions = msg;
              }
              params.set("targeting", JSON.stringify(targeting));
            }
          } else if (entity === "ad") {
            const { data: row } = await supa.from("meta_ads_ads").select("*").eq("id", id).maybeSingle();
            if (!row) return j({ error: "Anuncio no encontrado" }, 404);
            fbId = row.fb_ad_id;
            if (!fbId) return j({ ok: true, skipped: "local-only" });
            if (patch.name) params.set("name", patch.name);
            if (patch.status) params.set("status", patch.status);
          } else {
            return j({ error: "Entidad inválida" }, 400);
          }

          if ([...params.keys()].length <= 1) return j({ ok: true, skipped: "no-meta-fields" });

          const res = await fetch(`${base}/${fbId}`, { method: "POST", body: params });
          const body = await res.json();
          if (!res.ok) return j({ error: body?.error?.error_user_msg ?? body?.error?.message ?? "Error Meta API" }, 502);

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
