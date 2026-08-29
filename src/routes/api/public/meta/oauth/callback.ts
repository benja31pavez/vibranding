import { createFileRoute } from "@tanstack/react-router";

/**
 * Meta redirects the browser here after consent, so there is no app session:
 * the tenant travels in an HMAC-signed `state` created by startMetaOAuth.
 */
export const Route = createFileRoute("/api/public/meta/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;
        if (!appId || !appSecret) {
          console.error("[meta oauth] META_APP_ID/META_APP_SECRET missing");
          return new Response("Server misconfigured", { status: 500 });
        }

        const { verifyState, redirectUri, graph, META_SCOPES } = await import(
          "@/lib/meta/oauth.server"
        );

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const rawState = url.searchParams.get("state") ?? "";
        const denied = url.searchParams.get("error");

        const state = await verifyState(rawState, appSecret);
        if (!state) {
          console.error("[meta oauth] invalid or expired state");
          return new Response("Forbidden", { status: 403 });
        }
        const back = (status: string) =>
          Response.redirect(
            `${url.origin}/clients/${state.clientId}/meta-ads?meta=${status}`,
            302,
          );

        if (denied || !code) return back("cancelado");

        try {
          // 1. Code -> short-lived token, then a long-lived (60-day) user token.
          const short = await graph<any>("oauth/access_token", {
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri(),
            code,
          });
          const long = await graph<any>("oauth/access_token", {
            grant_type: "fb_exchange_token",
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: short.access_token,
          });
          const token: string = long.access_token ?? short.access_token;
          const expiresIn = Number(long.expires_in ?? short.expires_in ?? 0);

          // 2. Discover the first ad account, page and linked IG account.
          const [adAccounts, pages] = await Promise.all([
            graph<any>("me/adaccounts", {
              access_token: token,
              fields: "id,account_id,name,timezone_name",
              limit: "25",
            }).catch(() => ({ data: [] })),
            graph<any>("me/accounts", {
              access_token: token,
              fields: "id,name,instagram_business_account{id,username}",
              limit: "25",
            }).catch(() => ({ data: [] })),
          ]);
          const adAccount = (adAccounts.data ?? [])[0] ?? null;
          const page = (pages.data ?? []).find((p: any) => p.instagram_business_account)
            ?? (pages.data ?? [])[0]
            ?? null;

          // 3. Persist the connection (one per client) and vault the token.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: saved, error } = await (
            supabaseAdmin.from("meta_accounts" as any) as any
          )
            .upsert(
              {
                client_id: state.clientId,
                ad_account_id: adAccount?.id ?? null,
                page_id: page?.id ?? null,
                ig_account_id: page?.instagram_business_account?.id ?? null,
                business_name: page?.name ?? adAccount?.name ?? null,
                timezone_name: adAccount?.timezone_name ?? null,
                scopes: [...META_SCOPES],
                connected: true,
                token_expires_at:
                  expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
                last_sync_error: null,
              },
              { onConflict: "client_id" },
            )
            .select("id")
            .single();
          if (error) throw new Error(error.message);

          const { setMetaToken } = await import("@/lib/meta/tokens.server");
          await setMetaToken(saved.id, token);

          return back("conectado");
        } catch (e: any) {
          console.error("[meta oauth] exchange failed", e?.message);
          return back("error");
        }
      },
    },
  },
});
