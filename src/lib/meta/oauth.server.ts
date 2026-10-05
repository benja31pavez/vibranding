// Server-only helpers for the Meta OAuth flow.
export { metaGraphVersion, graphUrl, graphBase } from "@/lib/meta/version";
import { graphUrl } from "@/lib/meta/version";
export { META_SCOPES } from "@/lib/meta/scopes";

/**
 * Único origen público canónico. Meta sólo redirige a URIs registradas en la app,
 * así que no hay fallback: si falta la variable, fallamos de forma explícita.
 */
export function publicOrigin(): string {
  const raw = process.env.PUBLIC_SITE_URL?.trim();
  if (!raw) {
    throw new Error(
      "PUBLIC_SITE_URL no está configurada. Define el origen público canónico (ej. https://vibranding.pro).",
    );
  }
  return raw.replace(/\/$/, "");
}

export function redirectUri(): string {
  return `${publicOrigin()}/api/public/meta/oauth/callback`;
}

// El state firmado se comparte con Google Ads (src/lib/oauthState.server.ts).
export {
  createOAuthState,
  verifyState,
  redirectClearingOAuthCookie,
  type OAuthState,
} from "@/lib/oauthState.server";

export async function graph<T = any>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${graphUrl(path)}?${qs}`);
  const body = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(body?.error?.error_user_msg ?? body?.error?.message ?? "Error Meta API");
  }
  return body as T;
}
