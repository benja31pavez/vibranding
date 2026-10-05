// Cliente REST mínimo de Google Ads con fetch (compatible con Cloudflare Workers).
// Solo lectura: listAccessibleCustomers y googleAds:searchStream. Nunca muta campañas.
import {
  GOOGLE_ADS_API_BASE,
  GOOGLE_TOKEN_URL,
  googleRedirectUri,
  type GoogleAdsConfig,
} from "@/lib/google-ads/config.server";
import { googleAdsErrorMessage, normalizeCustomerId } from "@/lib/google-ads/gaql";

/** Error de OAuth/API con el código para decidir si hay que reconectar. */
export class GoogleAdsError extends Error {
  readonly status: number;
  /** true cuando el refresh token ya no sirve (revocado o expirado). */
  readonly needsReconnect: boolean;
  constructor(message: string, status: number, needsReconnect = false) {
    super(message);
    this.name = "GoogleAdsError";
    this.status = status;
    this.needsReconnect = needsReconnect;
  }
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || body.error) {
    const reconnect = body.error === "invalid_grant";
    const msg = reconnect
      ? "Google revocó o venció el acceso. Vuelve a conectar la cuenta de Google Ads."
      : `Google OAuth: ${body.error_description ?? body.error ?? `HTTP ${res.status}`}`;
    throw new GoogleAdsError(msg, res.status, reconnect);
  }
  return body;
}

/** Código de autorización → tokens (incluye refresh_token con access_type=offline). */
export async function exchangeCode(cfg: GoogleAdsConfig, code: string): Promise<TokenResponse> {
  return postToken({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });
}

/** Refresh token → access token (dura ~1 hora; no se guarda). */
export async function refreshAccessToken(
  cfg: GoogleAdsConfig,
  refreshToken: string,
): Promise<string> {
  const body = await postToken({
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
  if (!body.access_token) throw new GoogleAdsError("Google no devolvió un access token", 500);
  return body.access_token;
}

/**
 * Encabezados de cada llamada. login-customer-id va SOLO cuando se accede a la
 * cuenta a través de una MCC (si se manda una MCC que no la administra, Google
 * responde USER_PERMISSION_DENIED).
 */
function headers(cfg: GoogleAdsConfig, accessToken: string, loginCustomerId: string | null) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  // Desde el 9-sep-2026 el developer token es opcional (la API lo ignora); se envía si existe.
  if (cfg.developerToken) h["developer-token"] = cfg.developerToken;
  const login = normalizeCustomerId(loginCustomerId);
  if (login) h["login-customer-id"] = login;
  return h;
}

async function call(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new GoogleAdsError(`Google Ads: ${googleAdsErrorMessage(body, res.status)}`, res.status);
  }
  return body;
}

/** Cuentas a las que el usuario autorizado accede directamente (ids de 10 dígitos). */
export async function listAccessibleCustomers(
  cfg: GoogleAdsConfig,
  accessToken: string,
): Promise<string[]> {
  // login-customer-id no aplica a este método.
  const body = await call(`${GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`, {
    method: "GET",
    headers: headers(cfg, accessToken, null),
  });
  const resourceNames = (body as { resourceNames?: unknown } | null)?.resourceNames;
  const names: string[] = Array.isArray(resourceNames) ? resourceNames.map(String) : [];
  return names.map((n) => normalizeCustomerId(n)).filter((id): id is string => Boolean(id));
}

/** Ejecuta una consulta GAQL con searchStream y devuelve el cuerpo crudo (lotes). */
export async function searchStream(
  cfg: GoogleAdsConfig,
  accessToken: string,
  customerId: string,
  query: string,
  /** MCC por la que se accede (manager_customer_id), o null si el acceso es directo. */
  loginCustomerId: string | null,
): Promise<unknown> {
  const id = normalizeCustomerId(customerId);
  if (!id) throw new GoogleAdsError("customer_id inválido", 400);
  return call(`${GOOGLE_ADS_API_BASE}/customers/${id}/googleAds:searchStream`, {
    method: "POST",
    headers: headers(cfg, accessToken, loginCustomerId),
    body: JSON.stringify({ query }),
  });
}
