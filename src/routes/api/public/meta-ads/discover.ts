import { metaGraphVersion } from "@/lib/meta/version";
import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex } from "@/lib/crypto";

export const Route = createFileRoute("/api/public/meta-ads/discover")({
  server: {
    handlers: {
      GET: async () => {
        const token = process.env.META_ADS_ACCESS_TOKEN;
        const businessId = process.env.META_BUSINESS_ID;
        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;

        if (!token) return json({ error: "Falta META_ADS_ACCESS_TOKEN" }, 400);
        if (!businessId) return json({ error: "Falta META_BUSINESS_ID" }, 400);

        const v = metaGraphVersion();
        const base = `https://graph.facebook.com/${v}`;
        // appsecret_proof for extra security if app secret is present
        const proofParam = appSecret
          ? `&appsecret_proof=${await hmacSha256Hex(appSecret, token)}`
          : "";

        const debug: any = { app_id_present: !!appId, app_secret_present: !!appSecret };

        // 1. Token debug (who/what is this token)
        try {
          const tdRes = await fetch(`${base}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`);
          const td = await tdRes.json();
          debug.token = td?.data ?? td;
        } catch (e: any) {
          debug.token_error = e?.message;
        }

        // 2. Owned + client ad accounts of the business
        const adAccounts: any[] = [];
        for (const path of ["owned_ad_accounts", "client_ad_accounts"]) {
          const url = `${base}/${businessId}/${path}?fields=id,account_id,name,account_status,currency,timezone_name&limit=100&access_token=${encodeURIComponent(token)}${proofParam}`;
          const r = await fetch(url);
          const b = await r.json();
          if (!r.ok) return json({ error: b?.error?.message ?? `Error en ${path}`, debug, meta_error: b?.error }, 502);
          for (const a of b.data ?? []) adAccounts.push({ ...a, source: path });
        }

        // 3. Owned + client pages
        const pages: any[] = [];
        for (const path of ["owned_pages", "client_pages"]) {
          const url = `${base}/${businessId}/${path}?fields=id,name,category,tasks,instagram_business_account{id,username,name,profile_picture_url}&limit=100&access_token=${encodeURIComponent(token)}${proofParam}`;
          const r = await fetch(url);
          const b = await r.json();
          if (!r.ok) return json({ error: b?.error?.message ?? `Error en ${path}`, debug, meta_error: b?.error }, 502);
          for (const p of b.data ?? []) pages.push({ ...p, source: path });
        }

        // 4. Instagram business accounts owned by the business (some setups)
        let igAccounts: any[] = [];
        try {
          const url = `${base}/${businessId}/instagram_accounts?fields=id,username&limit=100&access_token=${encodeURIComponent(token)}${proofParam}`;
          const r = await fetch(url);
          const b = await r.json();
          if (r.ok) igAccounts = b.data ?? [];
        } catch {}

        return json({
          ok: true,
          summary: {
            ad_accounts: adAccounts.length,
            pages: pages.length,
            instagram_accounts_via_pages: pages.filter((p) => p.instagram_business_account).length,
            instagram_accounts_direct: igAccounts.length,
          },
          ad_accounts: adAccounts,
          pages,
          instagram_accounts: igAccounts,
          debug,
        });
      },
    },
  },
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

