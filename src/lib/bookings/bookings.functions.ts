import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  hours: { day: number; enabled: boolean; open: string; close: string }[],
  slotMin: number,
): boolean {
  const d = new Date(iso);
  // 0=Mon..6=Sun (matches our stored format)
  const idx = (d.getUTCDay() + 6) % 7;
  const today = hours.find((h) => h.day === idx);
  if (!today || !today.enabled) return false;
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  const openM = oh * 60 + om;
  const closeM = ch * 60 + cm;
  if (mins < openM || mins + slotMin > closeM) return false;
  if ((mins - openM) % slotMin !== 0) return false;
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

    if (!withinHours(data.scheduledAt, s.hours as any, s.slot_minutes)) {
      throw new Error("Ese horario no está disponible");
    }

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
    const { data: existing } = await supabase
      .from("booking_settings")
      .select("*")
      .eq("owner_user_id", userId)
      .is("client_id", data.clientId === null ? null : (undefined as any))
      .maybeSingle();
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
