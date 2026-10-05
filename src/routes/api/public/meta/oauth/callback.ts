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

        const { verifyState, redirectUri, graph, META_SCOPES, redirectClearingOAuthCookie } =
          await import("@/lib/meta/oauth.server");

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const rawState = url.searchParams.get("state") ?? "";
        const denied = url.searchParams.get("error");

        // Firma, vigencia, flujo "meta" y nonce == cookie del navegador que inició.
        const state = await verifyState(rawState, appSecret, "meta", request);
        if (!state) {
          console.error("[meta oauth] invalid or expired state");
          return new Response("Forbidden", { status: 403 });
        }
        const back = (status: string, errorMsg?: string) => {
          const target = new URL(`${url.origin}/clients/${state.clientId}/meta-ads`);
          target.searchParams.set("meta", status);
          if (errorMsg) target.searchParams.set("meta_error", errorMsg.slice(0, 300));
          return redirectClearingOAuthCookie(target.toString(), "meta");
        };

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
          // Errors are captured, never swallowed: without them the flow fails silently.
          const [adAccountsRes, pagesRes] = await Promise.all([
            graph<any>("me/adaccounts", {
              access_token: token,
              fields: "id,account_id,name,timezone_name",
              limit: "25",
            }).then(
              (data) => ({ data, error: null as string | null }),
              (e: any) => ({ data: { data: [] }, error: `adaccounts: ${e?.message ?? "error"}` }),
            ),
            graph<any>("me/accounts", {
              access_token: token,
              fields: "id,name,instagram_business_account{id,username}",
              limit: "25",
            }).then(
              (data) => ({ data, error: null as string | null }),
              (e: any) => ({ data: { data: [] }, error: `accounts: ${e?.message ?? "error"}` }),
            ),
          ]);
          const adAccounts = adAccountsRes.data;
          const pages = pagesRes.data;
          const discoveryErrors = [adAccountsRes.error, pagesRes.error].filter(Boolean).join(" · ");
          const adAccount = (adAccounts.data ?? [])[0] ?? null;
          const page = (pages.data ?? []).find((p: any) => p.instagram_business_account)
            ?? (pages.data ?? [])[0]
            ?? null;
          const igAccount = page?.instagram_business_account ?? null;

          // Only mark as connected if something usable was discovered.
          const connected = Boolean(adAccount || igAccount);
          if (!connected) {
            const msg = discoveryErrors
              || "No se descubrió ninguna cuenta publicitaria ni de Instagram con este token. Revisa permisos y roles en la app de Meta.";
            console.error("[meta oauth] discovery empty", { clientId: state.clientId, msg });
            // Persist the failure so the diagnostics page can show it.
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await (supabaseAdmin.from("meta_accounts" as any) as any).upsert(
              { client_id: state.clientId, connected: false, last_sync_error: msg },
              { onConflict: "client_id" },
            );
            return back("error", msg);
          }

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
                ig_account_id: igAccount?.id ?? null,
                business_name: page?.name ?? adAccount?.name ?? null,
                timezone_name: adAccount?.timezone_name ?? null,
                scopes: [...META_SCOPES],
                connected,
                token_expires_at:
                  expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
                last_sync_error: discoveryErrors || null,
              },
              { onConflict: "client_id" },
            )
            .select("id")
            .single();
          if (error) throw new Error(error.message);

          const { setMetaToken } = await import("@/lib/meta/tokens.server");
          await setMetaToken(saved.id, token);

          return back(
            "conectado",
            discoveryErrors ? `Conectado con advertencias: ${discoveryErrors}` : undefined,
          );
        } catch (e: any) {
          console.error("[meta oauth] exchange failed", e?.message);
          return back("error", e?.message ?? "Error al intercambiar el token con Meta");
        }
      },
    },
  },
});
