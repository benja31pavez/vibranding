// Shared Web Crypto helpers (Worker-safe).

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time comparison of two hex strings. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Compara un secreto recibido con el esperado en tiempo constante: HMAC de
 * ambos con el esperado como clave (longitud fija) y comparación constante.
 * Vacíos nunca coinciden.
 */
export async function secretsMatch(
  provided: string | null | undefined,
  expected: string,
): Promise<boolean> {
  if (!provided || !expected) return false;
  const [a, b] = await Promise.all([
    hmacSha256Hex(expected, provided),
    hmacSha256Hex(expected, expected),
  ]);
  return timingSafeEqualHex(a, b);
}
