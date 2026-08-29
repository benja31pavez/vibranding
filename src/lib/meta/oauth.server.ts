// Server-only helpers for the Meta OAuth flow.
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";

export { metaGraphVersion, graphUrl, graphBase } from "@/lib/meta/version";
import { graphUrl } from "@/lib/meta/version";
export const META_SCOPES = [
  "ads_read",
  "pages_read_engagement",
  "instagram_manage_insights",
] as const;

/** Stable public origin: Meta only redirects to URIs registered in the app. */
export function publicOrigin(): string {
  return process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://vibranding.pro";
}

export function redirectUri(): string {
  return `${publicOrigin()}/api/public/meta/oauth/callback`;
}

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

export type OAuthState = { clientId: string; userId: string; exp: number };

/**
 * The callback is a public route (Meta redirects the browser, no session), so the
 * state carries the tenant and is signed with the app secret to prevent forgery.
 */
export async function signState(state: OAuthState, appSecret: string): Promise<string> {
  const payload = b64url(JSON.stringify(state));
  const sig = await hmacSha256Hex(appSecret, payload);
  return `${payload}.${sig}`;
}

export async function verifyState(
  raw: string,
  appSecret: string,
): Promise<OAuthState | null> {
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = await hmacSha256Hex(appSecret, payload);
  if (!timingSafeEqualHex(sig.toLowerCase(), expected)) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(payload)) as OAuthState;
    if (!parsed.clientId || !parsed.userId) return null;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

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
