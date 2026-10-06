import { createServerFn } from "@tanstack/react-start";
import { requireOrgMember } from "@/lib/auth/requireOrgMember";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { bookingWindow, safeTimeZone, zonedParts } from "./tz";
import { parseOrThrow } from "./validation";

const SlotsInput = z.object({
  slug: z.string().min(1).max(80),
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const getBookingPage = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; from: string; to: string }) => parseOrThrow(SlotsInput, d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings, error } = await supabaseAdmin.rpc("get_booking_settings_by_slug", {
      _slug: data.slug,
    });
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
    const { turnstileSiteKey } = await import("./turnstile.server");
    const siteKey = turnstileSiteKey();
    return {
      settings: s,
      taken: (taken ?? []) as { scheduled_at: string; duration_minutes: number }[],
      /** Customer confirmation emails are only sent with Resend + Turnstile configured. */
      emailEnabled: isBookingEmailEnabled() && siteKey !== null,
      /** Public Turnstile site key; null when Turnstile is not configured. */
      turnstileSiteKey: siteKey,
    };
  });

/** Control characters (incl. CR/LF), stripped from single-line fields. */
// eslint-disable-next-line no-control-regex -- intencional: elimina caracteres de control
const CONTROL_CHARS = /[\u0000-\u001F\u007F]+/g;
/** Same but keeps \n (notes are multi-line). */
// eslint-disable-next-line no-control-regex -- intencional: elimina caracteres de control
const CONTROL_CHARS_EXCEPT_LF = /[\u0000-\u0009\u000B-\u001F\u007F]+/g;

const singleLine = (v: string) => v.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();

const BookingInput = z.object({
  slug: z.string().min(1).max(80),
  scheduledAt: z.string().datetime(),
  name: z.string().transform(singleLine).pipe(z.string().min(1).max(100)),
  email: z.string().trim().email().max(200),
  phone: z
    .string()
    .transform(singleLine)
    .pipe(
      z
        .string()
        .max(40)
        .regex(/^[0-9+()\-.\s]*$/),
    )
    .optional(),
  notes: z
    .string()
    .transform((v) => v.replace(CONTROL_CHARS_EXCEPT_LF, " ").trim())
    .pipe(z.string().max(1000))
    .optional(),
  turnstileToken: z.string().max(4096).optional(),
});

function withinHours(
  iso: string,
  hours: {
    day: number;
    enabled: boolean;
    open: string;
    close: string;
    breaks?: { start: string; end: string }[];
  }[],
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

/** Customer confirmations one recipient address may receive per 24 h (enforced in DB). */
const MAX_CONFIRMATIONS_PER_EMAIL_DAY = 3;

/** create_booking_atomic error messages -> public messages. */
const ATOMIC_ERRORS: Record<string, string> = {
  BOOKING_AGENDA_NOT_FOUND: "Agenda no encontrada",
  BOOKING_RATE_LIMITED: "Demasiadas reservas en poco tiempo. Intenta más tarde.",
  BOOKING_SLOT_TAKEN: "Ese horario ya fue tomado",
  BOOKING_IN_PAST: "Ese horario ya pasó. Elige otro.",
  BOOKING_MISSING_FIELDS: "Completa tu nombre y tu email.",
};

const UNIQUE_VIOLATION = "23505";

const RATE_LIMITED = "Demasiadas reservas en poco tiempo. Intenta más tarde.";

/** ip hash -> recent attempt timestamps. In-memory, so it is a first line only. */
const ipAttempts = new Map<string, number[]>();

function hashSalt(): string {
  return process.env["IP_HASH_SALT"] ?? process.env["SUPABASE_PROJECT_SALT"] ?? "landing";
}

/** Same IP derivation + salted hash as the landing contact form. */
async function clientIpHash(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const { createHash } = await import("crypto");
  return createHash("sha256").update(`${ip}:${hashSalt()}`).digest("hex");
}

/** Salted hash of a recipient address (the email log never stores addresses). */
async function emailHash(email: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256")
    .update(`email:${email.trim().toLowerCase()}:${hashSalt()}`)
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
      turnstileToken?: string;
    }) => parseOrThrow(BookingInput, d),
  )
  .handler(async ({ data }) => {
    // Misma regla de confianza que el resto (solo cf-connecting-ip en Cloudflare).
    const { clientIp } = await import("@/lib/security/ipRateLimit.server");
    const ip = clientIp();
    if (!allowIpAttempt(await clientIpHash(ip))) throw new Error(RATE_LIMITED);

    // Bot check before touching the agenda (only when Turnstile is configured).
    const { isTurnstileEnabled, verifyTurnstile } = await import("./turnstile.server");
    const turnstileOn = isTurnstileEnabled();
    if (turnstileOn && !(await verifyTurnstile(data.turnstileToken, ip))) {
      throw new Error(
        "No pudimos verificar que no eres un robot. Recarga la página e inténtalo de nuevo.",
      );
    }

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
    if (slotDate >= maxExclusive)
      throw new Error("Solo se permite agendar hasta 30 días en adelante");
    if (!withinHours(data.scheduledAt, s.hours as any, s.slot_minutes, tz)) {
      throw new Error("Ese horario no está disponible");
    }

    // Limits, overlap check and insert run atomically in the DB
    // (advisory lock per agenda), so concurrent requests cannot race them.
    const { data: rows, error: iErr } = await supabaseAdmin.rpc("create_booking_atomic", {
      _settings_id: s.id,
      _scheduled_at: data.scheduledAt,
      _name: data.name,
      _email: data.email,
      _phone: data.phone ?? "",
      _notes: data.notes ?? "",
      _max_per_email_day: BOOKING_LIMITS.perEmailPerDay,
      _max_per_agenda_hour: BOOKING_LIMITS.perAgendaPerHour,
    });
    if (iErr) {
      const known = ATOMIC_ERRORS[iErr.message];
      if (known) throw new Error(known);
      if (iErr.code === UNIQUE_VIOLATION) throw new Error(ATOMIC_ERRORS["BOOKING_SLOT_TAKEN"]);
      console.error("[booking] create_booking_atomic failed", iErr.code, iErr.message);
      throw new Error("No se pudo procesar la reserva. Intenta de nuevo.");
    }
    const created = (rows ?? [])[0];
    if (!created) throw new Error("No se pudo procesar la reserva. Intenta de nuevo.");
    const inserted = { id: created.booking_id, scheduled_at: created.booking_scheduled_at };

    // Emails are best-effort: a failure here never undoes the booking.
    try {
      const { isBookingEmailEnabled, sendBookingEmails } = await import("./notify.server");
      if (isBookingEmailEnabled()) {
        const { data: notif, error: nErr } = await supabaseAdmin
          .from("booking_settings")
          .select("notification_email")
          .eq("id", s.id)
          .maybeSingle();
        if (nErr) console.error("[booking] notification_email lookup failed", nErr.message);

        // Customer confirmation only behind Turnstile and a per-recipient cap.
        let sendCustomerConfirmation = false;
        if (turnstileOn) {
          const { data: allowed, error: cErr } = await supabaseAdmin.rpc(
            "claim_booking_email_slot",
            {
              _email_hash: await emailHash(data.email),
              _max_per_day: MAX_CONFIRMATIONS_PER_EMAIL_DAY,
            },
          );
          if (cErr) console.error("[booking] claim_booking_email_slot failed", cErr.message);
          sendCustomerConfirmation = !cErr && allowed === true;
        }

        await sendBookingEmails({
          ownerEmail: notif?.notification_email ?? null,
          agendaName: s.display_name ?? "Agenda",
          timeZone: tz,
          scheduledAt: inserted.scheduled_at,
          durationMinutes: s.slot_minutes,
          customer: { name: data.name, email: data.email, phone: data.phone, notes: data.notes },
          sendCustomerConfirmation,
        });
      } else {
        console.warn(
          "[booking] RESEND_API_KEY no configurada: no se envían correos de la reserva.",
        );
      }
    } catch (e) {
      console.error("[booking] notification failed", (e as Error)?.message ?? e);
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
  .middleware([requireOrgMember])
  .inputValidator((d: { clientId?: string | null }) => ({
    clientId: parseOrThrow(z.string().uuid().nullable(), d.clientId ?? null),
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId, claims } = context;
    // La RLS de booking_settings solo mira owner_user_id: el cliente debe ser de
    // la org del usuario (editor) para no colgar una agenda de un cliente ajeno.
    if (data.clientId) {
      const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
      await assertCanEditClient(userId, data.clientId);
    }
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
