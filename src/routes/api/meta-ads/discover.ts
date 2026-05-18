import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/meta-ads/discover")({
  server: {
    handlers: {
      GET: async () => {
        const token = process.env.META_ADS_ACCESS_TOKEN;
        if (!token) return json({ error: "Falta META_ADS_ACCESS_TOKEN" }, 400);
        try {
          // businesses owned by the system user
          const meRes = await fetch(
            `https://graph.facebook.com/v21.0/me/businesses?fields=id,name&access_token=${encodeURIComponent(token)}`,
          );
          const meBody = await meRes.json();
          if (!meRes.ok) return json({ error: meBody?.error?.message ?? "Error Meta API" }, 502);
          const businesses = (meBody.data ?? []) as Array<{ id: string; name: string }>;

          const adAccounts: Array<{ id: string; name: string; status: number; business: string }> = [];
          const pages: Array<{ id: string; name: string; business: string }> = [];

          for (const biz of businesses) {
            const [accRes, pageRes] = await Promise.all([
              fetch(`https://graph.facebook.com/v21.0/${biz.id}/owned_ad_accounts?fields=id,name,account_status&limit=50&access_token=${encodeURIComponent(token)}`),
              fetch(`https://graph.facebook.com/v21.0/${biz.id}/owned_pages?fields=id,name&limit=50&access_token=${encodeURIComponent(token)}`),
            ]);
            const accBody = await accRes.json();
            const pageBody = await pageRes.json();
            for (const a of accBody.data ?? []) {
              adAccounts.push({ id: a.id, name: a.name, status: a.account_status, business: biz.name });
            }
            for (const p of pageBody.data ?? []) {
              pages.push({ id: p.id, name: p.name, business: biz.name });
            }
          }

          return json({ businesses, adAccounts, pages });
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
