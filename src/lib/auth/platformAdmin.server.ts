/**
 * Platform (VIBRANDING operator) admin check.
 *
 * The data model has no platform-wide role: every signed-up user becomes the
 * "owner" of their own org via ensure_org(), so org roles cannot tell the
 * agency operator apart from anyone else. Cross-tenant tools (job health,
 * cron schedules) are therefore gated by an explicit allowlist:
 *
 *   PLATFORM_ADMIN_EMAILS="ana@example.com, ops@example.com"
 *
 * Missing/empty variable => nobody is admin (fail closed).
 */

export class PlatformAdminError extends Error {
  readonly status = 403 as const;
  constructor() {
    super("Solo un administrador de la plataforma puede usar esta función");
    this.name = "PlatformAdminError";
  }
}

export function platformAdminEmails(): ReadonlySet<string> {
  const raw = process.env["PLATFORM_ADMIN_EMAILS"] ?? "";
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

/**
 * True when the user's confirmed email is in the allowlist. Reads the user with
 * the service role (not the JWT) so an unconfirmed sign-up using an allowlisted
 * address is never treated as admin.
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const allowed = platformAdminEmails();
  if (!userId || allowed.size === 0) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return false;
  const email = (data.user.email ?? "").trim().toLowerCase();
  if (!email || !data.user.email_confirmed_at) return false;
  return allowed.has(email);
}

export async function assertPlatformAdmin(userId: string): Promise<void> {
  if (!(await isPlatformAdmin(userId))) throw new PlatformAdminError();
}
