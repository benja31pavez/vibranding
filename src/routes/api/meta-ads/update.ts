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
import { resolveAdAccountCurrency } from "@/lib/meta/accountCurrency.server";
import {
  MONEY_PATCH_FIELDS,
  updateBodySchema,
  zodMessage,
  type MoneyPatchField,
} from "@/lib/meta-ads/apiSchemas";

export const Route = createFileRoute("/api/meta-ads/update")({
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

          const parsed = updateBodySchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) return j({ error: zodMessage(parsed.error) }, 400);
          const { entity, id, confirmedAmounts, allowZero = [] } = parsed.data;
          const patch = parsed.data.patch as Record<string, any>;

          const base = graphBase();
          const params = new URLSearchParams();
          // Money is converted once the account currency is known (after auth).
          const money: Partial<Record<MoneyPatchField, number>> = {};
          let fbId: string | null = null;
          let rowClientId: string | null = null;

          if (entity === "campaign") {
            const { data: row } = await supa
              .from("meta_ads_campaigns")
              .select("*")
              .eq("id", id)
              .maybeSingle();
            if (!row) return j({ error: "Campaña no encontrada" }, 404);
            fbId = row.fb_campaign_id;
            rowClientId = (row as any).client_id;
            if (!fbId) return j({ ok: true, skipped: "local-only" });
            if (patch.name) params.set("name", patch.name);
            if (patch.status) params.set("status", patch.status);
            if (patch.objective) params.set("objective", patch.objective);
            if (patch.daily_budget != null) money.daily_budget = Number(patch.daily_budget);
            if (patch.lifetime_budget != null)
              money.lifetime_budget = Number(patch.lifetime_budget);
            if (patch.spend_cap != null) money.spend_cap = Number(patch.spend_cap);
            if (patch.bid_strategy) params.set("bid_strategy", patch.bid_strategy);
          } else if (entity === "adset") {
            const { data: row } = await supa
              .from("meta_ads_adsets")
              .select("*")
              .eq("id", id)
              .maybeSingle();
            if (!row) return j({ error: "Conjunto no encontrado" }, 404);
            fbId = row.fb_adset_id;
            rowClientId = (row as any).client_id;
            if (!fbId) return j({ ok: true, skipped: "local-only" });
            if (patch.name) params.set("name", patch.name);
            if (patch.status) params.set("status", patch.status);
            if (patch.daily_budget != null) money.daily_budget = Number(patch.daily_budget);
            if (patch.lifetime_budget != null)
              money.lifetime_budget = Number(patch.lifetime_budget);
            if (patch.optimization_goal) params.set("optimization_goal", patch.optimization_goal);
            if (patch.billing_event) params.set("billing_event", patch.billing_event);
            if (patch.bid_amount != null) money.bid_amount = Number(patch.bid_amount);
            if (patch.start_time)
              params.set("start_time", new Date(patch.start_time).toISOString());
            if (patch.end_time) params.set("end_time", new Date(patch.end_time).toISOString());
            // Targeting rebuild si vienen campos de segmentación
            if (
              patch.age_min != null ||
              patch.age_max != null ||
              patch.genders !== undefined ||
              patch.countries !== undefined ||
              patch.placements !== undefined ||
              patch.placement_mode !== undefined ||
              patch.device_platforms !== undefined
            ) {
              const merged = { ...row, ...patch };
              const targeting: any = {};
              const countries = String(merged.countries ?? "")
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);
              if (countries.length) targeting.geo_locations = { countries };
              if (merged.age_min) targeting.age_min = Number(merged.age_min);
              if (merged.age_max) targeting.age_max = Number(merged.age_max);
              const g = merged.genders;
              if (g === "male") targeting.genders = [1];
              else if (g === "female") targeting.genders = [2];
              if (merged.device_platforms?.length)
                targeting.device_platforms = merged.device_platforms;
              if (merged.placement_mode === "manual" && merged.placements?.length) {
                const fb: string[] = [],
                  ig: string[] = [],
                  an: string[] = [],
                  msg: string[] = [];
                const pubs = new Set<string>();
                for (const p of merged.placements as string[]) {
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
                  } else pubs.add(p);
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
            const { data: row } = await supa
              .from("meta_ads_ads")
              .select("*")
              .eq("id", id)
              .maybeSingle();
            if (!row) return j({ error: "Anuncio no encontrado" }, 404);
            fbId = row.fb_ad_id;
            rowClientId = (row as any).client_id;
            if (!fbId) return j({ ok: true, skipped: "local-only" });
            if (patch.name) params.set("name", patch.name);
            if (patch.status) params.set("status", patch.status);
          } else {
            return j({ error: "Entidad inválida" }, 400);
          }

          if ([...params.keys()].length === 0 && Object.keys(money).length === 0)
            return j({ ok: true, skipped: "no-meta-fields" });

          // Spending the agency's Meta token requires an editor role (owner/admin/agent)
          // in the client's org; viewers and portal users are rejected.
          const denied = await denyUnlessClientEditor(authHeader, rowClientId);
          if (denied) return denied;
          // Token from the Vault for this client (OAuth or System User), never env.
          const { requireClientMetaToken } = await import("@/lib/meta/clientToken.server");
          const { token } = await requireClientMetaToken(rowClientId!);
          params.set("access_token", token);

          // Pago de pauta: activar algo exige cuenta con medio de pago y al día.
          if (patch.status === "ACTIVE") {
            const { data: billingAcc } = await supa
              .from("meta_accounts")
              .select("ad_account_id")
              .eq("client_id", rowClientId!)
              .maybeSingle();
            const { verifyMetaBillingForActivation } = await import("@/lib/meta/billing.server");
            const billing = await verifyMetaBillingForActivation({
              clientId: rowClientId!,
              adAccountId: billingAcc?.ad_account_id ?? null,
              token,
            });
            if (!billing.ok)
              return j({ error: billing.message, code: "BILLING_NOT_VERIFIED" }, 409);
          }

          if (Object.keys(money).length > 0) {
            const { data: acc } = await supa
              .from("meta_accounts")
              .select("ad_account_id,currency")
              .eq("client_id", rowClientId!)
              .maybeSingle();
            if (!acc?.ad_account_id) return j({ error: "Configura la cuenta publicitaria" }, 400);
            const adAcc = acc.ad_account_id.startsWith("act_")
              ? acc.ad_account_id
              : `act_${acc.ad_account_id}`;
            const currency = await resolveAdAccountCurrency(adAcc, token, acc.currency);
            const pending = budgetConfirmationRequest(
              {
                daily: money.daily_budget,
                lifetime: money.lifetime_budget,
                spendCap: money.spend_cap,
                bid: money.bid_amount,
              },
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
            for (const field of MONEY_PATCH_FIELDS) {
              const amount = money[field];
              if (amount !== undefined) {
                params.set(
                  field,
                  String(toMetaAmount(amount, currency, { allowZero: allowZero.includes(field) })),
                );
              }
            }
          }

          const res = await fetch(`${base}/${fbId}`, { method: "POST", body: params });
          const body = await res.json();
          if (!res.ok)
            return j(
              { error: body?.error?.error_user_msg ?? body?.error?.message ?? "Error Meta API" },
              502,
            );

          return j({ ok: true });
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
