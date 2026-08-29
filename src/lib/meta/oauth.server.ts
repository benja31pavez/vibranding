// Server-only helpers for the Meta OAuth flow.
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";

/**
 * Graph / Marketing API version. Overridable with the META_GRAPH_VERSION env var
 * so future bumps need no code change. Default is the newest live version
 * (v23.0 expired 2026-06-09; anything below v25.0 is unsupported).
 */
const DEFAULT_META_GRAPH_VERSION = "v26.0";

export function metaGraphVersion(): string {
  const raw = process.env.META_GRAPH_VERSION?.trim();
  if (!raw) return DEFAULT_META_GRAPH_VERSION;
  return /^v\d+\.\d+$/.test(raw) ? raw : DEFAULT_META_GRAPH_VERSION;
}

export function graphUrl(path: string): string {
  return `https://graph.facebook.com/${metaGraphVersion()}/${path}`;
}
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
