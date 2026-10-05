// State firmado (HMAC-SHA256) para callbacks OAuth públicos (Meta, Google Ads).
//
// El callback no tiene sesión: el state lleva el cliente y el usuario y va
// firmado con el secreto de la app para que nadie pueda falsificarlo. Además
// se ata al navegador que inició el flujo: un nonce aleatorio viaja dentro del
// state firmado y en una cookie HttpOnly; el callback exige que coincidan
// (evita que un state robado o un enlace de consentimiento ajeno se complete
// en otro navegador: login CSRF / vinculación de cuenta ajena).
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";

export type OAuthPurpose = "google_ads" | "google_ads_agency" | "meta";

export type OAuthState = {
  /** Cliente del flujo; en "google_ads_agency" es el org_id de la agencia. */
  clientId: string;
  userId: string;
  exp: number;
  purpose: OAuthPurpose;
  /** 32 hex; también va en la cookie del navegador que inició el flujo. */
  nonce: string;
};

/** Vigencia del state y de la cookie. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const NONCE_RE = /^[0-9a-f]{32}$/;

const CALLBACK_PATH: Record<OAuthPurpose, string> = {
  google_ads: "/api/public/google/oauth/callback",
  // Mismo redirect URI registrado en Google Cloud; el flujo se distingue por el state.
  google_ads_agency: "/api/public/google/oauth/callback",
  meta: "/api/public/meta/oauth/callback",
};

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

export function newOAuthNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function oauthCookieName(purpose: OAuthPurpose): string {
  return `vb_oauth_${purpose}`;
}

/** Opciones de la cookie del nonce: solo viaja al callback de ese flujo. */
export function oauthCookieOptions(purpose: OAuthPurpose) {
  return {
    httpOnly: true,
    secure: true,
    // Lax: la cookie viaja en la redirección GET de nivel superior desde Google/Meta.
    sameSite: "lax" as const,
    path: CALLBACK_PATH[purpose],
    maxAge: Math.floor(OAUTH_STATE_TTL_MS / 1000),
  };
}

/** Set-Cookie que borra la cookie del nonce (para la respuesta del callback). */
export function clearOAuthCookieHeader(purpose: OAuthPurpose): string {
  return `${oauthCookieName(purpose)}=; Path=${CALLBACK_PATH[purpose]}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) {
      try {
        return decodeURIComponent(v.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Crea el state firmado y, con `setCookie` de @tanstack/react-start/server,
 * deja el nonce en la cookie HttpOnly del navegador que inicia el flujo.
 */
export async function createOAuthState(
  input: { clientId: string; userId: string; purpose: OAuthPurpose },
  secret: string,
): Promise<string> {
  const { setCookie } = await import("@tanstack/react-start/server");
  const nonce = newOAuthNonce();
  const state: OAuthState = { ...input, nonce, exp: Date.now() + OAUTH_STATE_TTL_MS };
  setCookie(oauthCookieName(input.purpose), nonce, oauthCookieOptions(input.purpose));
  const payload = b64url(JSON.stringify(state));
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

/**
 * Flujo declarado en el state SIN verificar (solo para elegir con qué
 * propósito llamar a verifyState, que es quien valida firma, vigencia y nonce).
 */
export function peekStatePurpose(raw: string): OAuthPurpose | null {
  const [payload] = raw.split(".");
  if (!payload) return null;
  try {
    const purpose = (JSON.parse(b64urlDecode(payload)) as { purpose?: unknown }).purpose;
    return purpose === "google_ads" || purpose === "google_ads_agency" || purpose === "meta"
      ? purpose
      : null;
  } catch {
    return null;
  }
}

/**
 * Devuelve el state si: la firma es válida, no expiró, es del flujo esperado y
 * el nonce coincide (tiempo constante) con la cookie del navegador. Si no, null.
 */
export async function verifyState(
  raw: string,
  secret: string,
  purpose: OAuthPurpose,
  request: Request,
): Promise<OAuthState | null> {
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = await hmacSha256Hex(secret, payload);
  if (!timingSafeEqualHex(sig.toLowerCase(), expected)) return null;
  let parsed: OAuthState;
  try {
    parsed = JSON.parse(b64urlDecode(payload)) as OAuthState;
  } catch {
    return null;
  }
  if (!parsed.clientId || !parsed.userId) return null;
  if (!parsed.exp || parsed.exp < Date.now()) return null;
  if (parsed.purpose !== purpose) return null;
  if (typeof parsed.nonce !== "string" || !NONCE_RE.test(parsed.nonce)) return null;
  const cookie = (readCookie(request, oauthCookieName(purpose)) ?? "").toLowerCase();
  if (!NONCE_RE.test(cookie) || !timingSafeEqualHex(cookie, parsed.nonce)) return null;
  return parsed;
}

/** Redirección 302 que además borra la cookie del nonce (Response.redirect es inmutable). */
export function redirectClearingOAuthCookie(location: string, purpose: OAuthPurpose): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Set-Cookie": clearOAuthCookieHeader(purpose) },
  });
}
