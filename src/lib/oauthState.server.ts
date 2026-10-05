// State firmado (HMAC-SHA256) para callbacks OAuth públicos (Meta, Google Ads).
// El callback no tiene sesión: el state lleva el cliente y el usuario y va
// firmado con el secreto de la app para que nadie pueda falsificarlo.
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";

export type OAuthState = { clientId: string; userId: string; exp: number };

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

export async function signState(state: OAuthState, secret: string): Promise<string> {
  const payload = b64url(JSON.stringify(state));
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

/** Devuelve el state si la firma es válida y no expiró; si no, null. */
export async function verifyState(raw: string, secret: string): Promise<OAuthState | null> {
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = await hmacSha256Hex(secret, payload);
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
