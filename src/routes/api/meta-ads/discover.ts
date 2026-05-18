import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/meta-ads/discover")({
  server: {
    handlers: {
      GET: async () => {
        const token = process.env.META_ADS_ACCESS_TOKEN;
        if (!token) return json({ error: "Falta META_ADS_ACCESS_TOKEN" }, 400);
        try {
          const t = encodeURIComponent(token);
          const base = "https://graph.facebook.com/v21.0";

          // Activos asignados al System User
          const [accRes, pageRes, bizRes] = await Promise.all([
            fetch(`${base}/me/assigned_ad_accounts?fields=id,name,account_status,business{name}&limit=100&access_token=${t}`),
            fetch(`${base}/me/assigned_pages?fields=id,name,instagram_business_account{id,username,profile_picture_url}&limit=100&access_token=${t}`),
            fetch(`${base}/me/businesses?fields=id,name&limit=50&access_token=${t}`),
          ]);
          const accBody = await accRes.json();
          const pageBody = await pageRes.json();
          const bizBody = await bizRes.json();
          if (!accRes.ok) return json({ error: accBody?.error?.message ?? "Error Meta API (ad accounts)" }, 502);
          if (!pageRes.ok) return json({ error: pageBody?.error?.message ?? "Error Meta API (pages)" }, 502);

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

          // Mapa para deduplicar IGs por id
          const igMap = new Map<string, { id: string; username: string; avatar: string; source: string }>();

          // (1) IGs vinculados a páginas
          for (const p of pages) {
            if (p.instagram) {
              igMap.set(p.instagram.id, { ...p.instagram, source: `vinculado a ${p.name}` });
            }
          }

          // (2) IGs asignados directamente al System User
          if (igAssignedRes.ok) {
            for (const i of (igAssignedBody.data ?? []) as any[]) {
              if (!igMap.has(i.id)) {
                igMap.set(i.id, { id: i.id, username: i.username ?? "", avatar: i.profile_pic ?? "", source: "asignado a System User" });
              }
            }
          }

          // (3) IGs propiedad del Business / clientes del Business (fallback que sí captura cuentas asignadas al Business)
          if (bizRes.ok) {
            const businesses = (bizBody.data ?? []) as any[];
            await Promise.all(
              businesses.flatMap((b) => [
                fetch(`${base}/${b.id}/owned_instagram_accounts?fields=id,username,profile_pic&limit=100&access_token=${t}`)
                  .then((r) => r.json())
                  .then((body) => {
                    for (const i of (body?.data ?? []) as any[]) {
                      if (!igMap.has(i.id)) {
                        igMap.set(i.id, { id: i.id, username: i.username ?? "", avatar: i.profile_pic ?? "", source: `Business: ${b.name}` });
                      }
                    }
                  })
                  .catch(() => {}),
                fetch(`${base}/${b.id}/client_instagram_accounts?fields=id,username,profile_pic&limit=100&access_token=${t}`)
                  .then((r) => r.json())
                  .then((body) => {
                    for (const i of (body?.data ?? []) as any[]) {
                      if (!igMap.has(i.id)) {
                        igMap.set(i.id, { id: i.id, username: i.username ?? "", avatar: i.profile_pic ?? "", source: `Cliente de: ${b.name}` });
                      }
                    }
                  })
                  .catch(() => {}),
              ]),
            );
          }

          const instagramAccounts = Array.from(igMap.values());

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
