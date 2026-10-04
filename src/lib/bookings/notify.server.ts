// Booking email notifications via Resend (https://resend.com/docs/api-reference/emails/send-email).
// Optional: without RESEND_API_KEY nothing is sent and a warning is logged.
// Never throws — a failed email must not block a booking.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Vibranding <reservas@vibranding.pro>";
const SEND_TIMEOUT_MS = 8000;

export function isBookingEmailEnabled(): boolean {
  return Boolean(process.env["RESEND_API_KEY"]?.trim());
}

type BookingEmailInput = {
  ownerEmail: string | null;
  agendaName: string;
  timeZone: string;
  scheduledAt: string;
  durationMinutes: number;
  customer: { name: string; email: string; phone?: string | null; notes?: string | null };
};

type Email = { kind: "dueño" | "cliente"; to: string; subject: string; text: string; html: string; replyTo?: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toHtml(lines: string[]): string {
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${lines
    .map((l) => (l ? `<p style="margin:0 0 8px">${escapeHtml(l)}</p>` : ""))
    .join("")}</div>`;
}

function formatWhen(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("es-CL", { dateStyle: "full", timeStyle: "short", timeZone });
}

function buildOwnerEmail(input: BookingEmailInput, when: string): Email | null {
  if (!input.ownerEmail) return null;
  const { customer } = input;
  const lines = [
    `Nueva reserva en "${input.agendaName}".`,
    "",
    `Fecha: ${when} (${input.timeZone})`,
    `Duración: ${input.durationMinutes} min`,
    `Nombre: ${customer.name}`,
    `Email: ${customer.email}`,
    `Teléfono: ${customer.phone || "-"}`,
    `Notas: ${customer.notes || "-"}`,
  ];
  return {
    kind: "dueño",
    to: input.ownerEmail,
    subject: `Nueva reserva: ${customer.name} · ${when}`,
    text: lines.join("\n"),
    html: toHtml(lines),
    replyTo: customer.email,
  };
}

function buildCustomerEmail(input: BookingEmailInput, when: string): Email {
  const lines = [
    `Hola ${input.customer.name},`,
    "",
    `Tu reserva en "${input.agendaName}" quedó registrada.`,
    `Fecha: ${when} (${input.timeZone})`,
    `Duración: ${input.durationMinutes} min`,
    "",
    "Si necesitas cambiarla o cancelarla, responde a este correo.",
  ];
  return {
    kind: "cliente",
    to: input.customer.email,
    subject: `Reserva confirmada · ${when}`,
    text: lines.join("\n"),
    html: toHtml(lines),
    replyTo: input.ownerEmail ?? undefined,
  };
}

async function sendViaResend(apiKey: string, from: string, email: Email): Promise<void> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
}

/** Sends the owner alert and the customer confirmation. Logs failures, never throws. */
export async function sendBookingEmails(input: BookingEmailInput): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  if (!apiKey) {
    console.warn("[booking] RESEND_API_KEY no configurada: no se envían correos de la reserva.");
    return;
  }
  const from = process.env["RESEND_FROM"]?.trim() || DEFAULT_FROM;
  const when = formatWhen(input.scheduledAt, input.timeZone);
  const emails = [buildOwnerEmail(input, when), buildCustomerEmail(input, when)].filter(
    (e): e is Email => e !== null,
  );
  const results = await Promise.allSettled(emails.map((e) => sendViaResend(apiKey, from, e)));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[booking] correo al ${emails[i]?.kind} falló:`, (r.reason as Error)?.message ?? r.reason);
    }
  });
}
