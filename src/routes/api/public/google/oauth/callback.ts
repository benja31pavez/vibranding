import { createFileRoute } from "@tanstack/react-router";
import type { GoogleOAuthErrorCode } from "@/lib/google-ads/oauthErrors";

/**
 * Google redirige el navegador aquí tras el consentimiento: no hay sesión, así
 * que el cliente viaja en un `state` firmado con HMAC y atado al navegador con
 * un nonce en cookie HttpOnly (startGoogleAdsOAuth). El refresh token se
 * guarda solo en Vault (google_ads_set_secret).
 *
 * En la URL de regreso solo van códigos cortos (?gads_error=<código>); el
 * navegador los traduce (src/lib/google-ads/oauthErrors.ts). Nunca texto de la API.
 */
export const Route = createFileRoute("/api/public/google/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getGoogleAdsConfig } = await import("@/lib/google-ads/config.server");
        const cfg = getGoogleAdsConfig();
        if (!cfg) {
          console.error("[google oauth] faltan variables GOOGLE_ADS_*");
          return new Response("Server misconfigured", { status: 500 });
        }

        const url = new URL(request.url);
        const { verifyState, redirectClearingOAuthCookie } =
          await import("@/lib/oauthState.server");
        // Firma, vigencia, flujo "google_ads" y nonce == cookie del navegador que inició.
        const state = await verifyState(
          url.searchParams.get("state") ?? "",
          cfg.clientSecret,
          "google_ads",
          request,
        );
        if (!state) {
          console.error("[google oauth] state inválido, vencido o de otro navegador");
          return new Response("Forbidden", { status: 403 });
        }

        const back = (status: string, code?: GoogleOAuthErrorCode) => {
          const target = new URL(`${url.origin}/clients/${state.clientId}/google-ads`);
          target.searchParams.set("gads", status);
          if (code) target.searchParams.set("gads_error", code);
          return redirectClearingOAuthCookie(target.toString(), "google_ads");
        };

        const code = url.searchParams.get("code");
        if (url.searchParams.get("error") || !code) return back("cancelado");

        // El usuario podría haber perdido el rol entre el inicio y el regreso.
        try {
          const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
          await assertCanEditClient(state.userId, state.clientId);
        } catch {
          return back("error", "forbidden");
        }

        const { exchangeCode, refreshAccessToken } = await import("@/lib/google-ads/client.server");
        let refreshToken: string;
        let accessToken: string;
        try {
          const tokens = await exchangeCode(cfg, code);
          if (!tokens.refresh_token) return back("error", "no_refresh_token");
          refreshToken = tokens.refresh_token;
          accessToken = tokens.access_token ?? (await refreshAccessToken(cfg, refreshToken));
        } catch (e) {
          console.error("[google oauth] canje del código falló", (e as Error).message);
          return back("error", "token_exchange");
        }

        const { discoverCustomers } = await import("@/lib/google-ads/accounts.server");
        const { chooseInitialCustomer, isLinkable } = await import("@/lib/google-ads/gaql");
        const {
          ConnectionError,
          getAccountByClient,
          getClientOrgId,
          getTakenCustomers,
          saveConnection,
        } = await import("@/lib/google-ads/connection.server");

        try {
          const orgId = await getClientOrgId(state.clientId);
          const [{ options, errors }, taken, current] = await Promise.all([
            discoverCustomers(cfg, accessToken),
            getTakenCustomers(state.clientId, orgId),
            getAccountByClient(state.clientId),
          ]);
          if (errors.length) console.error("[google oauth] avisos de discovery", errors);

          let saved;
          let confirmed: boolean;
          if (current) {
            // Reconexión: NUNCA se cambia de cuenta en silencio. Si la cuenta que
            // ya tenía sigue accesible se mantiene; si no, queda "pendiente" con
            // la misma cuenta hasta que alguien elija en la pantalla.
            const same = options.find((o) => o.customerId === current.customer_id);
            confirmed = Boolean(same && isLinkable(same));
            saved = await saveConnection({
              clientId: state.clientId,
              orgId,
              option: same ?? {
                customerId: current.customer_id,
                name: null,
                managerId: current.manager_customer_id,
                isManager: false,
                currency: null,
                timeZone: null,
              },
              status: confirmed ? "conectada" : "pendiente",
              refreshToken,
            });
          } else {
            const choice = chooseInitialCustomer(options, new Set(taken.keys()));
            if (!choice) {
              if (options.length === 0 && errors.length) return back("error", "google_api");
              return back("error", options.length === 0 ? "no_accounts" : "no_free_accounts");
            }
            confirmed = choice.confirmed;
            saved = await saveConnection({
              clientId: state.clientId,
              orgId,
              option: choice.option,
              // Con varias cuentas posibles queda "pendiente" hasta que se elija en la pantalla.
              status: confirmed ? "conectada" : "pendiente",
              refreshToken,
            });
          }

          if (!confirmed) return back("elegir");
          const { ingestAccount, BACKFILL_DAYS } = await import("@/lib/google-ads/ingest.server");
          const sync = await ingestAccount(saved, BACKFILL_DAYS, cfg);
          return back("conectado", sync.error ? "sync_failed" : undefined);
        } catch (e) {
          console.error("[google oauth] fallo", (e as Error).message);
          if (e instanceof ConnectionError) return back("error", e.code);
          return back("error", "google_api");
        }
      },
    },
  },
});
