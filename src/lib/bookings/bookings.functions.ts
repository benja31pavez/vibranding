import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { zonedParts } from "./tz";

const SlotsInput = z.object({
  slug: z.string().min(1).max(80),
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const getBookingPage = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; from: string; to: string }) =>
    SlotsInput.parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings, error } = await supabaseAdmin
      .rpc("get_booking_settings_by_slug", { _slug: data.slug });
    if (error) throw new Error(error.message);
    const s = (settings ?? [])[0];
    if (!s) throw new Error("Agenda no encontrada o deshabilitada");

    const { data: taken } = await supabaseAdmin.rpc("list_taken_slots", {
      _settings_id: s.id,
      _from: data.from,
      _to: data.to,
    });

    return {
      settings: s,
      taken: (taken ?? []) as { scheduled_at: string; duration_minutes: number }[],
    };
  });

const BookingInput = z.object({
  slug: z.string().min(1).max(80),
  scheduledAt: z.string().datetime(),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

function withinHours(
  iso: string,
  hours: { day: number; enabled: boolean; open: string; close: string; breaks?: { start: string; end: string }[] }[],
  slotMin: number,
  timeZone: string,
): boolean {
  const { dayIdx, minutes: mins } = zonedParts(iso, timeZone);
  const today = hours.find((h) => h.day === dayIdx);
  if (!today || !today.enabled) return false;
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  const openM = oh * 60 + om;
  const closeM = ch * 60 + cm;
  if (mins < openM || mins + slotMin > closeM) return false;
  if ((mins - openM) % slotMin !== 0) return false;
  for (const br of today.breaks ?? []) {
    if (!br?.start || !br?.end) continue;
    const [bsH, bsM] = br.start.split(":").map(Number);
    const [beH, beM] = br.end.split(":").map(Number);
    const bs = bsH * 60 + bsM;
    const be = beH * 60 + beM;
    if (mins < be && mins + slotMin > bs) return false;
  }
  return true;
}

/** Public booking abuse limits. */
const BOOKING_LIMITS = {
  /** Bookings one IP may create per window (best-effort, per server instance). */
  perIp: 5,
  ipWindowMs: 60 * 60 * 1000,
  /** Bookings one email may create per agenda in the last 24 h (enforced in DB). */
  perEmailPerDay: 3,
  /** Bookings one agenda accepts per hour, whoever sends them (enforced in DB). */
  perAgendaPerHour: 20,
} as const;

const RATE_LIMITED = "Demasiadas reservas en poco tiempo. Intenta más tarde.";

/** ip hash -> recent attempt timestamps. In-memory, so it is a first line only. */
const ipAttempts = new Map<string, number[]>();

/** Same IP derivation + salted hash as the landing contact form. */
async function clientIpHash(): Promise<string | null> {
  const req = getRequest();
  const ip =
    req?.headers.get("cf-connecting-ip") ??
    req?.headers.get("x-real-ip") ??
    req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  if (!ip) return null;
  const { createHash } = await import("crypto");
  return createHash("sha256")
    .update(`${ip}:${process.env["SUPABASE_PROJECT_SALT"] ?? "landing"}`)
    .digest("hex");
}

/** Records an attempt and returns false when the IP is over its limit. */
function allowIpAttempt(ipHash: string | null, now = Date.now()): boolean {
  if (!ipHash) return true;
  const since = now - BOOKING_LIMITS.ipWindowMs;
  const recent = (ipAttempts.get(ipHash) ?? []).filter((t) => t > since);
  if (recent.length >= BOOKING_LIMITS.perIp) {
    ipAttempts.set(ipHash, recent);
    return false;
  }
  ipAttempts.set(ipHash, [...recent, now]);
  // Keep the map bounded on long-lived instances.
  if (ipAttempts.size > 5000) {
    for (const [key, times] of ipAttempts) {
      if (!times.some((t) => t > since)) ipAttempts.delete(key);
    }
  }
  return true;
}

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      slug: string;
      scheduledAt: string;
      name: string;
      email: string;
      phone?: string;
      notes?: string;
    }) => BookingInput.parse(d),
  )
  .handler(async ({ data }) => {
    if (!allowIpAttempt(await clientIpHash())) throw new Error(RATE_LIMITED);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settingsRows, error: sErr } = await supabaseAdmin.rpc(
      "get_booking_settings_by_slug",
      { _slug: data.slug },
    );
    if (sErr) throw new Error(sErr.message);
    const s = (settingsRows ?? [])[0];
    if (!s) throw new Error("Agenda no encontrada");

    const slotDate = new Date(data.scheduledAt);
    const now = new Date();
    // Must be tomorrow or later (UTC date comparison)
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const maxDate = new Date(now);
    maxDate.setUTCDate(maxDate.getUTCDate() + 31);
    if (slotDate < tomorrow) throw new Error("Solo puedes agendar a partir de mañana");
    if (slotDate > maxDate) throw new Error("Solo se permite agendar hasta 30 días en adelante");
    const tz = (s as any).timezone || "America/Santiago";
    if (!withinHours(data.scheduledAt, s.hours as any, s.slot_minutes, tz)) {
      throw new Error("Ese horario no está disponible");
    }

    // Persistent caps (survive restarts and multiple instances): per email per
    // day and per agenda per hour, counted on bookings already stored.
    // Not atomic: two simultaneous requests can both pass the count before
    // either inserts (at most a request or two over the cap). Making it atomic
    // means moving count + insert into one SECURITY DEFINER RPC with an
    // advisory lock per agenda; deferred because that RPC would only exist
    // after a manual migration and this path must work without it.
    // TODO(seguridad): add Cloudflare Turnstile to the public booking form
    // (widget in book.$slug.tsx + server-side siteverify here) to stop bots
    // rotating IPs/emails; the limits below are only a backstop.
    const email = data.email.toLowerCase();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [{ count: byEmail, error: eErr }, { count: byAgenda, error: aErr }] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("settings_id", s.id)
        // Case-insensitive exact match: escape LIKE wildcards ("_" is valid in emails).
        .ilike("customer_email", email.replace(/[\\%_]/g, (c) => `\\${c}`))
        .gte("created_at", dayAgo),
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("settings_id", s.id)
        .gte("created_at", hourAgo),
    ]);
    if (eErr || aErr) {
      console.error("[booking] rate-limit count failed", eErr?.message ?? aErr?.message);
      throw new Error("No se pudo procesar la reserva. Intenta de nuevo.");
    }
    if ((byEmail ?? 0) >= BOOKING_LIMITS.perEmailPerDay) throw new Error(RATE_LIMITED);
    if ((byAgenda ?? 0) >= BOOKING_LIMITS.perAgendaPerHour) throw new Error(RATE_LIMITED);

    // Insert (unique index prevents double-booking)
    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        owner_user_id: s.owner_user_id,
        client_id: s.client_id,
        settings_id: s.id,
        scheduled_at: data.scheduledAt,
        duration_minutes: s.slot_minutes,
        customer_name: data.name,
        customer_email: data.email,
        customer_phone: data.phone || null,
        notes: data.notes || null,
        status: "confirmed",
      })
      .select("id, scheduled_at")
      .single();
    if (iErr) {
      if (iErr.code === "23505") throw new Error("Ese horario ya fue tomado");
      throw new Error(iErr.message);
    }

    // Send notification email if infra is configured
    try {
      const { data: settingsFull } = await supabaseAdmin
        .from("booking_settings")
        .select("notification_email, display_name, timezone")
        .eq("id", s.id)
        .maybeSingle();
      const to = settingsFull?.notification_email;
      if (to) {
        const fmt = new Date(data.scheduledAt).toLocaleString("es-CL", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: settingsFull?.timezone || "America/Santiago",
        });
        const body = `Nueva reserva en "${settingsFull?.display_name ?? "Agenda"}"\n\nFecha: ${fmt}\nNombre: ${data.name}\nEmail: ${data.email}\nTeléfono: ${data.phone || "-"}\nNotas: ${data.notes || "-"}`;
        // Best-effort — uses Lovable Emails queue if available
        await fetch(`${process.env.SUPABASE_URL}/functions/v1/send-email-stub`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject: "Nueva reserva", body }),
        }).catch(() => {});
        console.log("[booking] notification target:", to, "\n", body);
      }
    } catch (e) {
      console.error("[booking] notification failed", e);
    }

    return { id: inserted.id, scheduled_at: inserted.scheduled_at };
  });

export const ensureBookingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId?: string | null }) => ({
    clientId: d.clientId ?? null,
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const query = supabase
      .from("booking_settings")
      .select("*")
      .eq("owner_user_id", userId);
    const { data: existing } = await (data.clientId === null
      ? query.is("client_id", null)
      : query.eq("client_id", data.clientId)
    ).maybeSingle();
    if (existing) return existing;

    // Generate slug
    let displayName = "Agenda";
    if (data.clientId) {
      const { data: c } = await supabase
        .from("clients")
        .select("name")
        .eq("id", data.clientId)
        .maybeSingle();
      displayName = c?.name ? `Agenda · ${c.name}` : "Agenda";
    }
    const seed = (displayName || "agenda")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    const slug = `${seed}-${Math.random().toString(36).slice(2, 7)}`;

    const insertPayload: any = {
      owner_user_id: userId,
      client_id: data.clientId,
      slug,
      display_name: displayName,
    };
    const { data: created, error } = await supabase
      .from("booking_settings")
      .insert(insertPayload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });
