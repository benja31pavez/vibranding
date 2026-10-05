/**
 * "Recordar pago": mensajes de cobro según la etapa del vencimiento.
 *
 * Módulo puro (sin window ni Supabase): arma el texto y los links, nunca envía nada.
 * El dueño revisa el mensaje y lo manda él mismo (copiar, WhatsApp o correo).
 * Fechas YYYY-MM-DD en hora de Chile; montos solo en CLP.
 */
import { SITE_URL } from "@/lib/site";
import { formatMoney } from "@/lib/pricing/plans";
import { BILLING_TIME_ZONE } from "@/lib/billing/dates";
import { UPCOMING_DAYS } from "@/lib/billing/openPayments";
import { whatsappDigits } from "@/lib/followups/rules";

// ------------------------------------------------------------------ constantes

/** Días de atraso desde los que el tono pasa a "firme pero cordial". */
export const FIRM_AFTER_DAYS = 7;
/** Días de atraso desde los que se avisa una posible pausa del servicio. */
export const PAUSE_AFTER_DAYS = 15;
/** Ventana previa al vencimiento en que vale la pena recordar (hoy incluido). */
export const REMIND_BEFORE_DAYS = UPCOMING_DAYS;
/** Firma de los mensajes. */
export const REMINDER_SIGNATURE = "Equipo Vibranding";
/** Antigüedad máxima (días) para confiar en el link de Flow guardado; después puede haber expirado. */
export const FLOW_LINK_MAX_AGE_DAYS = 6;
/** Única moneda que se cobra/recuerda. */
export const REMINDER_CURRENCY = "CLP";
/** Link de respaldo cuando el cobro no tiene link de Flow: sección Pagos del portal. */
export const PORTAL_PAYMENTS_URL = `${SITE_URL}/portal#pagos`;

const DAY_MS = 86_400_000;

// ------------------------------------------------------------------ tipos

export type ReminderStage = "amable" | "hoy" | "vencido" | "firme" | "pausa";

export interface ReminderPayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  due_date: string | null;
  payment_url: string | null;
  /** Timestamp de creación del cobro; si falta, el link de Flow no se usa. */
  created_at?: string | null;
}

export interface ReminderInput {
  payment: ReminderPayment;
  clientName: string;
  contactName?: string | null;
  today: string;
}

export interface ReminderMessage {
  stage: ReminderStage;
  subject: string;
  body: string;
  link: string;
}

export const STAGE_LABEL: Readonly<Record<ReminderStage, string>> = {
  amable: "Antes del vencimiento",
  hoy: "Vence hoy",
  vencido: "Recién vencido",
  firme: `Atrasado +${FIRM_AFTER_DAYS} días`,
  pausa: `Atrasado +${PAUSE_AFTER_DAYS} días`,
};

// ------------------------------------------------------------------ fechas

function isoToUtcNoon(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);
}

/** Días entre `today` y el vencimiento: >0 faltan, 0 hoy, <0 atrasado. null sin fecha. */
export function daysUntilDue(dueDate: string | null, today: string): number | null {
  if (!dueDate) return null;
  return Math.round((isoToUtcNoon(dueDate) - isoToUtcNoon(today)) / DAY_MS);
}

const DUE_FMT = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BILLING_TIME_ZONE,
});

/** "2026-10-17" → "17 de octubre de 2026" (fecha de Chile). */
export function formatDueDate(iso: string): string {
  // Mediodía UTC cae el mismo día calendario en America/Santiago.
  return DUE_FMT.format(new Date(isoToUtcNoon(iso)));
}

// ------------------------------------------------------------------ etapas

export function isOpenPayment(p: { status: string }): boolean {
  return p.status === "pending" || p.status === "overdue";
}

export function isClp(p: { currency: string | null }): boolean {
  return (p.currency ?? "").trim().toUpperCase() === REMINDER_CURRENCY;
}

export function reminderStage(p: Pick<ReminderPayment, "status" | "due_date">, today: string): ReminderStage {
  const days = daysUntilDue(p.due_date, today);
  if (days === null) return p.status === "overdue" ? "vencido" : "amable";
  if (days > 0) return "amable";
  if (days === 0) return "hoy";
  const late = -days;
  if (late >= PAUSE_AFTER_DAYS) return "pausa";
  if (late >= FIRM_AFTER_DAYS) return "firme";
  return "vencido";
}

/** Abierto y (atrasado o vence dentro de la ventana). */
export function needsReminder(
  p: Pick<ReminderPayment, "status" | "due_date" | "currency">,
  today: string,
): boolean {
  if (!isOpenPayment(p) || !isClp(p)) return false;
  if (p.status === "overdue") return true;
  const days = daysUntilDue(p.due_date, today);
  return days !== null && days <= REMIND_BEFORE_DAYS;
}

/** Puntaje de urgencia: más atraso = más alto. Sin fecha va al final. */
export function urgencyScore(p: Pick<ReminderPayment, "status" | "due_date">, today: string): number {
  const days = daysUntilDue(p.due_date, today);
  if (days === null) return p.status === "overdue" ? 0 : Number.NEGATIVE_INFINITY;
  return -days;
}

/** Cobros por recordar, del más urgente al menos (empate: monto mayor primero). */
export function sortByUrgency<T extends ReminderPayment>(rows: readonly T[], today: string): T[] {
  return rows
    .filter((r) => needsReminder(r, today))
    .sort((a, b) => urgencyScore(b, today) - urgencyScore(a, today) || b.amount - a.amount);
}

// ------------------------------------------------------------------ mensaje

function isRecent(createdAt: string | null | undefined, today: string): boolean {
  const created = createdAt ? Date.parse(createdAt) : Number.NaN;
  if (!Number.isFinite(created)) return false;
  return isoToUtcNoon(today) - created < FLOW_LINK_MAX_AGE_DAYS * DAY_MS;
}

/**
 * Link de Flow solo si el cobro aún no vence (antes / el día), es https y es reciente
 * (los links de Flow expiran). Atrasado o dudoso → sección Pagos del portal.
 */
export function paymentLinkFor(
  p: Pick<ReminderPayment, "payment_url" | "created_at">,
  stage: ReminderStage,
  today: string,
): string {
  const url = p.payment_url?.trim();
  const notYetDue = stage === "amable" || stage === "hoy";
  if (notYetDue && url && /^https:\/\//i.test(url) && isRecent(p.created_at, today)) return url;
  return PORTAL_PAYMENTS_URL;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

function whenText(dueDate: string | null, today: string): string {
  const days = daysUntilDue(dueDate, today);
  if (days === null || !dueDate) return "";
  const date = formatDueDate(dueDate);
  if (days === 0) return `vence hoy, ${date}`;
  if (days === 1) return `vence mañana, ${date}`;
  if (days > 1) return `vence el ${date}`;
  return `venció el ${date}`;
}

interface TemplateCtx {
  greeting: string;
  detail: string;
  when: string;
  link: string;
  late: number;
}

const TEMPLATES: Readonly<Record<ReminderStage, (c: TemplateCtx) => string[]>> = {
  amable: (c) => [
    `${c.greeting}, ¿cómo estás?`,
    `Te escribo para recordarte que ${c.detail}${c.when ? ` ${c.when}` : " está pendiente"}.`,
    `Puedes pagarlo aquí cuando te acomode: ${c.link}`,
    "Si ya lo pagaste, no te preocupes por este mensaje. ¡Gracias!",
  ],
  hoy: (c) => [
    `${c.greeting}, ¿cómo estás?`,
    `Un recordatorio rápido: ${c.detail} ${c.when}.`,
    `Puedes pagarlo aquí: ${c.link}`,
    "Si ya lo pagaste, ignora este mensaje. ¡Muchas gracias!",
  ],
  vencido: (c) => [
    `${c.greeting}, ¿cómo estás?`,
    `Te escribo porque ${c.detail} ${c.when || "ya está vencido"} y aún lo vemos pendiente.`,
    `Puedes pagarlo aquí: ${c.link}`,
    "Si ya lo pagaste, avísanos para revisarlo. ¡Gracias!",
  ],
  firme: (c) => [
    `${c.greeting}:`,
    `Te escribimos por ${c.detail}, que ${c.when} y lleva ${c.late} días de atraso.`,
    `Te pedimos regularizarlo a la brevedad aquí: ${c.link}`,
    "Si tienes algún problema con el pago, cuéntanos y lo vemos juntos.",
  ],
  pausa: (c) => [
    `${c.greeting}:`,
    `${capitalize(c.detail)} ${c.when} y lleva ${c.late} días de atraso.`,
    `Para continuar con el servicio sin interrupciones necesitamos regularizarlo. De lo contrario, tendremos que pausar el trabajo hasta recibir el pago.`,
    `Puedes pagarlo aquí: ${c.link}`,
    "Si necesitas coordinar una fecha, respóndenos y lo conversamos.",
  ],
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const SUBJECTS: Readonly<Record<ReminderStage, string>> = {
  amable: "Recordatorio de pago",
  hoy: "Tu pago vence hoy",
  vencido: "Pago pendiente",
  firme: "Pago atrasado",
  pausa: "Pago atrasado: aviso de pausa del servicio",
};

export function buildReminder({ payment, clientName, contactName, today }: ReminderInput): ReminderMessage {
  const stage = reminderStage(payment, today);
  const days = daysUntilDue(payment.due_date, today);
  const contact = firstName(contactName?.trim() ?? "");
  const client = clientName.trim();
  const concept = payment.description?.trim() || "servicios Vibranding";
  const link = paymentLinkFor(payment, stage, today);
  // Con contacto: "Hola María" + "el cobro de {cliente}". Sin contacto: el saludo ya nombra al cliente.
  const greeting = contact ? `Hola ${contact}` : client ? `Hola, equipo de ${client}` : "Hola";
  const ofClient = contact && client ? ` de ${client}` : "";
  const ctx: TemplateCtx = {
    greeting,
    detail: `el cobro${ofClient} por "${concept}" de ${formatMoney(payment.amount)}`,
    when: whenText(payment.due_date, today),
    link,
    late: days !== null && days < 0 ? -days : 0,
  };
  const body = [...TEMPLATES[stage](ctx), "", REMINDER_SIGNATURE].join("\n");
  return { stage, subject: `${SUBJECTS[stage]} · ${concept}`, body, link };
}

// ------------------------------------------------------------------ links (no envían nada)

/** wa.me con el texto; null si el teléfono no sirve. */
export function reminderWhatsappHref(phone: string | null | undefined, text: string): string | null {
  const digits = whatsappDigits(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

/** mailto: con asunto y cuerpo codificados; null si no hay un correo válido. */
export function reminderMailtoHref(
  email: string | null | undefined,
  subject: string,
  body: string,
): string | null {
  const to = email?.trim() ?? "";
  if (!EMAIL.test(to)) return null;
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ------------------------------------------------------------------ "Recordado hoy" (localStorage)

/**
 * No hay columna ni tabla para registrar recordatorios, así que se guarda como
 * preferencia de este navegador, por usuario. Solo dura el día (hora de Chile).
 */
export const REMINDED_STORAGE_PREFIX = "vb:cobros:recordado-hoy";

export function remindedStorageKey(userId: string): string {
  return `${REMINDED_STORAGE_PREFIX}:${userId}`;
}

/** id del cobro → fecha (YYYY-MM-DD) en que se recordó. */
export type RemindedMap = Readonly<Record<string, string>>;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function parseReminded(raw: string | null, today: string): RemindedMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (e): e is [string, string] => typeof e[1] === "string" && YMD.test(e[1]) && e[1] === today,
      ),
    );
  } catch {
    return {};
  }
}

export function withReminded(map: RemindedMap, paymentId: string, today: string): RemindedMap {
  return { ...map, [paymentId]: today };
}

export function wasRemindedToday(map: RemindedMap, paymentId: string, today: string): boolean {
  return map[paymentId] === today;
}
