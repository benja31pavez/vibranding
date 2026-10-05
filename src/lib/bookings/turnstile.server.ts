// Cloudflare Turnstile (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
// Enabled only when both TURNSTILE_SITE_KEY (public) and TURNSTILE_SECRET_KEY are set.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 8000;

function siteKey(): string | null {
  return process.env["TURNSTILE_SITE_KEY"]?.trim() || null;
}

function secretKey(): string | null {
  return process.env["TURNSTILE_SECRET_KEY"]?.trim() || null;
}

/** Public site key for the widget, or null when Turnstile is not fully configured. */
export function turnstileSiteKey(): string | null {
  return siteKey() && secretKey() ? siteKey() : null;
}

export function isTurnstileEnabled(): boolean {
  return turnstileSiteKey() !== null;
}

/** Validates a widget token with siteverify. Returns false on any failure. */
export async function verifyTurnstile(
  token: string | undefined,
  remoteIp: string | null,
): Promise<boolean> {
  const secret = secretKey();
  if (!secret || !token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteIp) form.append("remoteip", remoteIp);
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[booking] turnstile siteverify HTTP", res.status);
      return false;
    }
    const body = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!body.success) console.warn("[booking] turnstile rechazado", body["error-codes"] ?? []);
    return body.success === true;
  } catch (e) {
    console.error("[booking] turnstile siteverify failed", (e as Error)?.message);
    return false;
  }
}
