// Regreso de Google tras conectar la MCC de la agencia (purpose "google_ads_agency").
// El state firmado lleva el org_id en `clientId` y está atado al navegador por nonce.
import type { GoogleAdsConfig } from "@/lib/google-ads/config.server";
import type { GoogleOAuthErrorCode } from "@/lib/google-ads/oauthErrors";
import { chooseAgencyManager } from "@/lib/google-ads/agency";

export async function handleAgencyOAuthCallback(
  request: Request,
  cfg: GoogleAdsConfig,
): Promise<Response> {
  const url = new URL(request.url);
  const { verifyState, redirectClearingOAuthCookie } = await import("@/lib/oauthState.server");
  const state = await verifyState(
    url.searchParams.get("state") ?? "",
    cfg.clientSecret,
    "google_ads_agency",
    request,
  );
  if (!state) {
    console.error("[google oauth agencia] state inválido, vencido o de otro navegador");
    return new Response("Forbidden", { status: 403 });
  }
  const orgId = state.clientId;

  const back = (status: string, code?: GoogleOAuthErrorCode) => {
    const target = new URL(`${url.origin}/settings/google-ads`);
    target.searchParams.set("gads", status);
    if (code) target.searchParams.set("gads_error", code);
    return redirectClearingOAuthCookie(target.toString(), "google_ads_agency");
  };

  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code) return back("cancelado");

  const { canManageOrg, getUserOrg, listAccessibleManagers, saveAgencyConnection } =
    await import("@/lib/google-ads/agency.server");
  // El usuario podría haber perdido el rol entre el inicio y el regreso.
  try {
    const org = await getUserOrg(state.userId);
    if (!org || org.orgId !== orgId || !canManageOrg(org.role)) return back("error", "forbidden");
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
    console.error("[google oauth agencia] canje del código falló", (e as Error).message);
    return back("error", "token_exchange");
  }

  try {
    const { managers, errors } = await listAccessibleManagers(cfg, accessToken);
    if (errors.length) console.error("[google oauth agencia] avisos", errors);
    const choice = chooseAgencyManager(managers, cfg.loginCustomerId);
    if (choice === "none") {
      return back("error", errors.length && managers.length === 0 ? "google_api" : "no_manager");
    }
    await saveAgencyConnection({
      orgId,
      userId: state.userId,
      manager: choice,
      // Varias MCC: el token queda guardado y el dueño elige en Configuración.
      status: choice ? "conectada" : "pendiente",
      refreshToken,
    });
    return back(choice ? "conectado" : "elegir");
  } catch (e) {
    console.error("[google oauth agencia] fallo", (e as Error).message);
    return back("error", "save_failed");
  }
}
