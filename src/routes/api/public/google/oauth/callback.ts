import { createFileRoute } from "@tanstack/react-router";

/**
 * Google redirige el navegador aquí tras el consentimiento: no hay sesión, así
 * que el cliente viaja en un `state` firmado con HMAC (startGoogleAdsOAuth).
 * El refresh token se guarda solo en Vault (google_ads_set_secret).
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
        const { verifyState } = await import("@/lib/oauthState.server");
        const state = await verifyState(url.searchParams.get("state") ?? "", cfg.clientSecret);
        if (!state) {
          console.error("[google oauth] state inválido o vencido");
          return new Response("Forbidden", { status: 403 });
        }

        const back = (status: string, detail?: string) => {
          const target = new URL(`${url.origin}/clients/${state.clientId}/google-ads`);
          target.searchParams.set("gads", status);
          if (detail) target.searchParams.set("gads_error", detail.slice(0, 300));
          return Response.redirect(target.toString(), 302);
        };

        const code = url.searchParams.get("code");
        if (url.searchParams.get("error") || !code) return back("cancelado");

        try {
          // El usuario podría haber perdido el rol entre el inicio y el regreso.
          const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
          await assertCanEditClient(state.userId, state.clientId);

          const { exchangeCode, refreshAccessToken } =
            await import("@/lib/google-ads/client.server");
          const tokens = await exchangeCode(cfg, code);
          if (!tokens.refresh_token) {
            return back(
              "error",
              "Google no entregó un token permanente. Quita el acceso de la app en tu cuenta de Google y vuelve a conectar.",
            );
          }
          const accessToken =
            tokens.access_token ?? (await refreshAccessToken(cfg, tokens.refresh_token));

          const { discoverCustomers } = await import("@/lib/google-ads/accounts.server");
          const { chooseInitialCustomer } = await import("@/lib/google-ads/gaql");
          const { getAccountByClient, getClientOrgId, getTakenCustomers, saveConnection } =
            await import("@/lib/google-ads/connection.server");
          const orgId = await getClientOrgId(state.clientId);
          const [{ options, errors }, taken, current] = await Promise.all([
            discoverCustomers(cfg, accessToken),
            getTakenCustomers(state.clientId, orgId),
            getAccountByClient(state.clientId),
          ]);

          const choice = chooseInitialCustomer(
            options,
            new Set(taken.keys()),
            current?.customer_id ?? null,
          );
          if (!choice) {
            const msg =
              options.length === 0
                ? "Esta cuenta de Google no tiene acceso a ninguna cuenta de Google Ads."
                : "No hay cuentas en CLP libres: las accesibles son administradoras (MCC), están en otra moneda o ya están vinculadas a otros clientes.";
            console.error("[google oauth] sin cuenta elegible", {
              clientId: state.clientId,
              errors,
            });
            return back("error", errors.length ? `${msg} (${errors[0]})` : msg);
          }

          const saved = await saveConnection({
            clientId: state.clientId,
            orgId,
            option: choice.option,
            // Con varias cuentas posibles queda "pendiente" hasta que se elija en la pantalla.
            status: choice.confirmed ? "conectada" : "pendiente",
            refreshToken: tokens.refresh_token,
          });

          if (!choice.confirmed) return back("elegir");
          const { ingestAccount, BACKFILL_DAYS } = await import("@/lib/google-ads/ingest.server");
          const sync = await ingestAccount(saved, BACKFILL_DAYS, cfg);
          return back(
            "conectado",
            sync.error ? `Conectado, pero la primera descarga falló: ${sync.error}` : undefined,
          );
        } catch (e) {
          const message = (e as Error).message ?? "Error al conectar con Google";
          console.error("[google oauth] fallo", message);
          return back("error", message);
        }
      },
    },
  },
});
