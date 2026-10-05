import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  landingId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(2000),
  /** Hidden field: only bots fill it in. */
  honeypot: z.string().max(200).optional(),
});

export type ContactSubmitResult = { ok: boolean; reason?: "invalid" | "rate_limited" };

/**
 * Public endpoint for landing contact forms. The database function enforces the
 * per-IP and per-landing limit (5 per hour) and drops honeypot hits silently,
 * so the table no longer accepts anonymous inserts directly.
 */
export const submitLandingContact = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<ContactSubmitResult> => {
    // Misma regla de confianza que el resto (solo cf-connecting-ip en Cloudflare).
    const { clientIp } = await import("@/lib/security/ipRateLimit.server");
    const ip = clientIp();

    const { createHash } = await import("crypto");
    const ipHash = ip
      ? createHash("sha256")
          .update(`${ip}:${process.env["IP_HASH_SALT"] ?? process.env["SUPABASE_PROJECT_SALT"] ?? "landing"}`)
          .digest("hex")
      : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await (supabaseAdmin as any).rpc("submit_landing_contact", {
      _landing_id: data.landingId,
      _name: data.name,
      _email: data.email,
      _phone: data.phone || null,
      _message: data.message,
      _ip_hash: ipHash,
      _honeypot: data.honeypot ?? null,
    });
    if (error) throw new Error(error.message);
    return (res ?? { ok: false }) as ContactSubmitResult;
  });
