import { graphBase } from "@/lib/meta/version";
import { denyUnlessClientEditor } from "@/lib/auth/clientAccess.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { toMetaAmount, budgetConfirmationRequest, BUDGET_CONFIRMATION_REQUIRED, MetaCurrencyError } from "@/lib/meta/currency";
import { createCampaignBodySchema, zodMessage } from "@/lib/meta-ads/apiSchemas";
import { resolveAdAccountCurrency } from "@/lib/meta/accountCurrency.server";

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

          const parsed = createCampaignBodySchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
          const { campaignId, confirmedAmounts } = parsed.data;

          const { data: c } = await userClient
            .from("meta_ads_campaigns").select("*").eq("id", campaignId).maybeSingle();
          if (!c) return json({ error: "Campaña no encontrada" }, 404);
          // Spending the agency's Meta token requires an editor role (owner/admin/agent)
          // in the client's org; viewers and portal users are rejected.
          const denied = await denyUnlessClientEditor(authHeader, c.client_id);
          if (denied) return denied;
          if (c.fb_campaign_id) return json({ error: "Esta campaña ya existe en Meta", fb_campaign_id: c.fb_campaign_id }, 400);

          const { data: acc } = await userClient
            .from("meta_accounts").select("ad_account_id,currency").eq("client_id", c.client_id).maybeSingle();
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
          if (c.daily_budget || c.lifetime_budget) {
            // Meta wants minimum units per the account currency offset (CLP = 1, USD = 100).
            const currency = await resolveAdAccountCurrency(adAcc, token, acc.currency);
            const pending = budgetConfirmationRequest(
              { daily: c.daily_budget, lifetime: c.lifetime_budget },
              currency,
              confirmedAmounts,
            );
            if (pending) {
              return json({ error: pending.message, code: BUDGET_CONFIRMATION_REQUIRED, requiresConfirmation: pending.amounts }, 409);
            }
            if (c.daily_budget) params.set("daily_budget", String(toMetaAmount(c.daily_budget, currency)));
            if (c.lifetime_budget) params.set("lifetime_budget", String(toMetaAmount(c.lifetime_budget, currency)));
          }

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
          if (e instanceof MetaCurrencyError) return json({ error: e.message }, 400);
          return json({ error: e?.message ?? "Error inesperado" }, 500);
        }
      },
    },
  },
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
