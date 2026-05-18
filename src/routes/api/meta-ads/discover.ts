import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/meta-ads/discover")({
  server: {
    handlers: {
      GET: async () => {
        const token = process.env.META_ADS_ACCESS_TOKEN;
        if (!token) return json({ error: "Falta META_ADS_ACCESS_TOKEN" }, 400);
        try {
          const t = encodeURIComponent(token);
          const [accRes, pageRes, igRes] = await Promise.all([
            fetch(`https://graph.facebook.com/v21.0/me/assigned_ad_accounts?fields=id,name,account_status,business{name}&limit=100&access_token=${t}`),
            fetch(`https://graph.facebook.com/v21.0/me/assigned_pages?fields=id,name,instagram_business_account{id,username,profile_picture_url}&limit=100&access_token=${t}`),
            fetch(`https://graph.facebook.com/v21.0/me/assigned_instagram_accounts?fields=id,username,profile_pic&limit=100&access_token=${t}`),
          ]);
          const accBody = await accRes.json();
          const pageBody = await pageRes.json();
          const igBody = await igRes.json();
          if (!accRes.ok) return json({ error: accBody?.error?.message ?? "Error Meta API (ad accounts)" }, 502);
          if (!pageRes.ok) return json({ error: pageBody?.error?.message ?? "Error Meta API (pages)" }, 502);
          // igRes puede fallar sin permiso instagram_basic — lo toleramos

          const adAccounts = ((accBody.data ?? []) as any[]).map((a) => ({
            id: a.id, name: a.name, status: a.account_status, business: a.business?.name ?? "",
          }));
          const pages = ((pageBody.data ?? []) as any[]).map((p) => ({
            id: p.id,
            name: p.name,
            business: "",
            instagram: p.instagram_business_account
              ? {
                  id: p.instagram_business_account.id,
                  username: p.instagram_business_account.username ?? "",
                  avatar: p.instagram_business_account.profile_picture_url ?? "",
                }
              : null,
          }));
          const instagramAccounts = igRes.ok
            ? ((igBody.data ?? []) as any[]).map((i) => ({
                id: i.id,
                username: i.username ?? "",
                avatar: i.profile_pic ?? "",
              }))
            : [];

          return json({ adAccounts, pages, instagramAccounts });
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
