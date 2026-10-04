import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { bookingWindow, safeTimeZone, zonedParts } from "./tz";
import { parseOrThrow } from "./validation";

const SlotsInput = z.object({
  slug: z.string().min(1).max(80),
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const getBookingPage = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; from: string; to: string }) =>
    parseOrThrow(SlotsInput, d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings, error } = await supabaseAdmin
      .rpc("get_booking_settings_by_slug", { _slug: data.slug });
    if (error) {
      console.error("[booking] get_booking_settings_by_slug failed", error.message);
      throw new Error("No se pudo cargar la agenda. Intenta de nuevo.");
    }
    const s = (settings ?? [])[0];
    if (!s) throw new Error("Agenda no encontrada o deshabilitada");

    const { data: taken, error: tErr } = await supabaseAdmin.rpc("list_taken_slots", {
      _settings_id: s.id,
      _from: data.from,
      _to: data.to,
    });
    if (tErr) {
      console.error("[booking] list_taken_slots failed", tErr.message);
      throw new Error("No se pudo cargar la disponibilidad. Intenta de nuevo.");
    }

    const { isBookingEmailEnabled } = await import("./notify.server");
    return {
      settings: s,
      taken: (taken ?? []) as { scheduled_at: string; duration_minutes: number }[],
      /** Whether confirmation emails are actually sent (RESEND_API_KEY set). */
      emailEnabled: isBookingEmailEnabled(),
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

/** How far back to look for bookings that could still overlap a new slot. */
const OVERLAP_LOOKBACK_MS = 24 * 60 * 60 * 1000;

const UNIQUE_VIOLATION = "23505";

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
    .update(`${ip}:${process.env["IP_HASH_SALT"] ?? process.env["SUPABASE_PROJECT_SALT"] ?? "landing"}`)
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
    }) => parseOrThrow(BookingInput, d),
  )
  .handler(async ({ data }) => {
    if (!allowIpAttempt(await clientIpHash())) throw new Error(RATE_LIMITED);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settingsRows, error: sErr } = await supabaseAdmin.rpc(
      "get_booking_settings_by_slug",
      { _slug: data.slug },
    );
    if (sErr) {
      console.error("[booking] get_booking_settings_by_slug failed", sErr.message);
      throw new Error("No se pudo procesar la reserva. Intenta de nuevo.");
    }
    const s = (settingsRows ?? [])[0];
    if (!s) throw new Error("Agenda no encontrada");

    const slotDate = new Date(data.scheduledAt);
    // "Tomorrow" and the 30-day limit are calendar days in the agenda's zone.
    const tz = safeTimeZone(s.timezone);
    const { minBookable, maxExclusive } = bookingWindow(tz);
    if (slotDate < minBookable) throw new Error("Solo puedes agendar a partir de mañana");
    if (slotDate >= maxExclusive) throw new Error("Solo se permite agendar hasta 30 días en adelante");
    if (!withinHours(data.scheduledAt, s.hours as any, s.slot_minutes, tz)) {
      throw new Error("Ese horario no está disponible");
    }

    // Reject overlaps (e.g. after the slot length changed); the unique index
    // only catches bookings that start at the exact same minute.
    const slotStart = slotDate.getTime();
    const slotEnd = slotStart + s.slot_minutes * 60_000;
    const { data: nearby, error: ovErr } = await supabaseAdmin.rpc("list_taken_slots", {
      _settings_id: s.id,
      _from: new Date(slotStart - OVERLAP_LOOKBACK_MS).toISOString(),
      _to: new Date(slotEnd).toISOString(),
    });
    if (ovErr) {
      console.error("[booking] overlap check failed", ovErr.message);
      throw new Error("No se pudo procesar la reserva. Intenta de nuevo.");
    }
    const overlaps = (nearby ?? []).some((b: { scheduled_at: string; duration_minutes: number }) => {
      const start = new Date(b.scheduled_at).getTime();
      return start < slotEnd && start + b.duration_minutes * 60_000 > slotStart;
    });
    if (overlaps) throw new Error("Ese horario ya fue tomado");

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
      if (iErr.code === UNIQUE_VIOLATION) throw new Error("Ese horario ya fue tomado");
      console.error("[booking] insert failed", iErr.code, iErr.message);
      throw new Error("No se pudo procesar la reserva. Intenta de nuevo.");
    }

    // Emails are best-effort: a failure here never undoes the booking.
    try {
      const { data: notif, error: nErr } = await supabaseAdmin
        .from("booking_settings")
        .select("notification_email")
        .eq("id", s.id)
        .maybeSingle();
      if (nErr) console.error("[booking] notification_email lookup failed", nErr.message);
      const { sendBookingEmails } = await import("./notify.server");
      await sendBookingEmails({
        ownerEmail: notif?.notification_email ?? null,
        agendaName: s.display_name ?? "Agenda",
        timeZone: tz,
        scheduledAt: inserted.scheduled_at,
        durationMinutes: s.slot_minutes,
        customer: { name: data.name, email: data.email, phone: data.phone, notes: data.notes },
      });
    } catch (e) {
      console.error("[booking] notification failed", e);
    }

    return { id: inserted.id, scheduled_at: inserted.scheduled_at };
  });

/** Reads the user's agenda (oldest first, so legacy duplicates resolve to one row). */
async function findBookingSettings(
  supabase: SupabaseClient<Database>,
  userId: string,
  clientId: string | null,
) {
  const base = supabase.from("booking_settings").select("*").eq("owner_user_id", userId);
  const scoped = clientId === null ? base.is("client_id", null) : base.eq("client_id", clientId);
  const { data, error } = await scoped
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[booking] read booking_settings failed", error.message);
    throw new Error("No se pudo cargar la agenda. Intenta de nuevo.");
  }
  return data;
}

function slugify(text: string): string {
  return (text || "agenda")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export const ensureBookingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId?: string | null }) => ({
    clientId: parseOrThrow(z.string().uuid().nullable(), d.clientId ?? null),
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId, claims } = context;
    // Never create when the read failed (findBookingSettings throws on error).
    const existing = await findBookingSettings(supabase, userId, data.clientId);
    if (existing) return existing;

    let displayName = "Agenda";
    if (data.clientId) {
      const { data: c, error: cErr } = await supabase
        .from("clients")
        .select("name")
        .eq("id", data.clientId)
        .maybeSingle();
      if (cErr) throw new Error("No se pudo cargar el cliente de la agenda.");
      displayName = c?.name ? `Agenda · ${c.name}` : "Agenda";
    }
    const ownerEmail = typeof claims?.email === "string" ? claims.email : null;

    const { data: created, error } = await supabase
      .from("booking_settings")
      .insert({
        owner_user_id: userId,
        client_id: data.clientId,
        slug: `${slugify(displayName)}-${crypto.randomUUID().slice(0, 8)}`,
        display_name: displayName,
        notification_email: ownerEmail,
      })
      .select("*")
      .single();
    if (!error) return created;

    // Another request (e.g. a second component mounting) created it first:
    // the unique index rejects ours, so return the row that won.
    if (error.code === UNIQUE_VIOLATION) {
      const winner = await findBookingSettings(supabase, userId, data.clientId);
      if (winner) return winner;
    }
    console.error("[booking] create booking_settings failed", error.code, error.message);
    throw new Error("No se pudo crear la agenda. Intenta de nuevo.");
  });
