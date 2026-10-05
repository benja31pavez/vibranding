/**
 * Reglas puras de "seguimientos sugeridos": a partir de filas ya leídas de la BD
 * calcula qué contactar hoy, por qué, con qué prioridad y con qué mensaje.
 *
 * - Sin E/S ni React: se prueba con datos falsos y `now` fijo.
 * - Todas las fechas de calendario se evalúan en America/Santiago.
 * - Nunca sugiere contactar prospectos en 'baja', 'frio' o 'perdido', ni con
 *   `no_contactar_hasta` futuro (tampoco por sus propuestas).
 * - WhatsApp solo si hay teléfono y el contacto ya respondió alguna vez
 *   (respondio/demo/propuesta/ganado) o es cliente: nunca WhatsApp en frío.
 */
import { chileDate } from "@/lib/dates/chile";
import { formatClp } from "@/lib/site";
import { findPlan } from "@/lib/pricing/plans";
import type { Followup, FollowupKind, FollowupPriority } from "./types";

// ------------------------------------------------------------------ umbrales

export const THRESHOLDS = {
  /** Propuesta enviada y no abierta. */
  proposalUnseenDays: 2,
  /** Propuesta abierta y no aceptada. */
  proposalSeenDays: 3,
  /** Propuesta vigente que vence dentro de N días (hoy incluido). */
  proposalExpiringDays: 2,
  /** Prospecto "contactado" sin respuesta. */
  contactedDays: 4,
  /** Prospecto "respondio"/"demo" sin avance. */
  warmDays: 3,
  /** Cobro pendiente que vence dentro de N días (hoy incluido). */
  paymentDueSoonDays: 3,
  /** Cliente con onboarding enviado y sin completar. */
  onboardingDays: 3,
} as const;

const BASE_SCORE: Readonly<Record<FollowupKind, number>> = {
  cobro_vencido: 100,
  propuesta_por_vencer: 90,
  propuesta_sin_respuesta: 80,
  cobro_por_vencer: 60,
  prospecto_sin_avance: 55,
  propuesta_no_vista: 50,
  onboarding_pendiente: 45,
  prospecto_sin_respuesta: 30,
  reporte_sin_enviar: 25,
  pedir_resena: 15,
};

/** Días extra suman urgencia, con tope para no saltarse de categoría. */
const MAX_AGE_BONUS = 9;

const PRIORITY: Readonly<Record<FollowupKind, FollowupPriority>> = {
  cobro_vencido: "alta",
  propuesta_por_vencer: "alta",
  propuesta_sin_respuesta: "alta",
  cobro_por_vencer: "media",
  prospecto_sin_avance: "media",
  propuesta_no_vista: "media",
  onboarding_pendiente: "media",
  prospecto_sin_respuesta: "baja",
  reporte_sin_enviar: "baja",
  pedir_resena: "baja",
};

/** Estados de prospecto que nunca se contactan desde aquí. */
export const BLOCKED_PROSPECT_STATES: ReadonlySet<string> = new Set(["baja", "frio", "perdido"]);
/** Estados que prueban que el prospecto ya respondió alguna vez (habilitan WhatsApp). */
export const RESPONDED_PROSPECT_STATES: ReadonlySet<string> = new Set([
  "respondio",
  "demo",
  "propuesta",
  "ganado",
]);
const OPEN_PROPOSAL_STATES: ReadonlySet<string> = new Set(["enviada", "vista"]);
const INACTIVE_CLIENT_STATES: ReadonlySet<string> = new Set(["terminado", "pausado"]);

// ------------------------------------------------------------------ entradas

export interface ProposalInput {
  id: string;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  expires_at: string | null;
  token: string;
  title: string | null;
  amount_clp: number;
  plan_key: string | null;
  client_id: string | null;
  prospect_id: string | null;
}

export interface ProspectInput {
  id: string;
  nombre: string;
  estado: string;
  ultimo_contacto: string | null;
  updated_at: string;
  no_contactar_hasta?: string | null;
  telefono_publico: string | null;
  client_id?: string | null;
  producto_sugerido: string | null;
}

export interface PaymentInput {
  id: string;
  client_id: string;
  amount: number;
  currency: string;
  due_date: string | null;
  status: string;
  payment_url: string | null;
  description: string | null;
}

export interface ClientInput {
  id: string;
  name: string;
  status: string;
  created_at: string;
  started_at: string | null;
}

export interface BillingInput {
  client_id: string;
  plan_key: string | null;
  onboarding_token: string | null;
  onboarding_token_expires_at: string | null;
}

export interface IntakeInput {
  client_id: string;
  contacto_telefono: string | null;
}

export interface ReportInput {
  id: string;
  client_id: string;
  period: string;
  token: string;
  sent_at: string | null;
}

export interface FollowupSources {
  proposals: readonly ProposalInput[];
  prospects: readonly ProspectInput[];
  payments: readonly PaymentInput[];
  clients: readonly ClientInput[];
  billing: readonly BillingInput[];
  intakes: readonly IntakeInput[];
  reports: readonly ReportInput[];
}

// ------------------------------------------------------------------ fechas

const DAY_MS = 86_400_000;

function ymdToUtc(ymd: string): number {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Días de calendario (Chile) entre dos fechas YYYY-MM-DD: b - a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((ymdToUtc(b) - ymdToUtc(a)) / DAY_MS);
}

/** Fecha de calendario en Chile de un timestamp ISO; null si no es válido. */
export function chileYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  // Columnas `date` ("YYYY-MM-DD") ya son fechas de calendario.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : chileDate(d);
}

/** "7 de octubre" para una fecha YYYY-MM-DD. */
export function longDateLabel(ymd: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(ymdToUtc(ymd)));
}

/** "septiembre" para un periodo YYYY-MM-01. */
export function monthLabel(period: string): string {
  return new Intl.DateTimeFormat("es-CL", { month: "long", timeZone: "UTC" }).format(
    new Date(ymdToUtc(period)),
  );
}

/** Primer día del mes anterior al de `today` (mes cerrado). */
export function closedPeriod(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}

const ago = (days: number) => (days === 1 ? "hace 1 día" : `hace ${days} días`);

function dueLabel(days: number): string {
  if (days <= 0) return "hoy";
  if (days === 1) return "mañana";
  return `en ${days} días`;
}

// ------------------------------------------------------------------ teléfono / WhatsApp

const MIN_WA_DIGITS = 10;
const MAX_WA_DIGITS = 15;

/** Normaliza un teléfono a dígitos internacionales para wa.me (Chile por defecto). null si no sirve. */
export function whatsappDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const raw = phone.replace(/\D/g, "").replace(/^00/, "");
  // Prefijo troncal: 09XXXXXXXX → 9XXXXXXXX.
  const digits = raw.length === 10 && raw.startsWith("0") ? raw.slice(1) : raw;
  // Celular chileno sin código de país: 9XXXXXXXX.
  const full = digits.length === 9 && digits.startsWith("9") ? `56${digits}` : digits;
  return full.length >= MIN_WA_DIGITS && full.length <= MAX_WA_DIGITS ? full : null;
}

export function whatsappHref(phone: string, text: string): string | null {
  const digits = whatsappDigits(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

// ------------------------------------------------------------------ índices

interface Context {
  today: string;
  nowMs: number;
  clientById: ReadonlyMap<string, ClientInput>;
  prospectById: ReadonlyMap<string, ProspectInput>;
  /** Prospecto de origen de cada cliente convertido (prospects.client_id). */
  prospectByClient: ReadonlyMap<string, ProspectInput>;
  intakeByClient: ReadonlyMap<string, IntakeInput>;
  billingByClient: ReadonlyMap<string, BillingInput>;
}

function buildContext(src: FollowupSources, now: Date): Context {
  const prospectByClient = new Map<string, ProspectInput>();
  for (const p of src.prospects) if (p.client_id) prospectByClient.set(p.client_id, p);
  return {
    today: chileDate(now),
    nowMs: now.getTime(),
    clientById: new Map(src.clients.map((c) => [c.id, c])),
    prospectById: new Map(src.prospects.map((p) => [p.id, p])),
    prospectByClient,
    intakeByClient: new Map(src.intakes.map((i) => [i.client_id, i])),
    billingByClient: new Map(src.billing.map((b) => [b.client_id, b])),
  };
}

/** ¿Se puede contactar hoy a este prospecto? (no baja/frío/perdido ni "no contactar hasta" futuro). */
export function isContactable(p: ProspectInput, today: string): boolean {
  if (BLOCKED_PROSPECT_STATES.has(p.estado)) return false;
  const until = chileYmd(p.no_contactar_hasta ?? null);
  return !(until && until > today);
}

/** Teléfono de un cliente: el del onboarding o el público del prospecto de origen (si no pidió baja). */
function clientPhone(ctx: Context, clientId: string): string | null {
  const origin = ctx.prospectByClient.get(clientId);
  if (origin && origin.estado === "baja") return null;
  return (
    ctx.intakeByClient.get(clientId)?.contacto_telefono?.trim() ||
    origin?.telefono_publico?.trim() ||
    null
  );
}

/** Teléfono para WhatsApp de un prospecto, solo si ya respondió alguna vez. */
function prospectPhone(p: ProspectInput): string | null {
  if (!RESPONDED_PROSPECT_STATES.has(p.estado)) return null;
  return p.telefono_publico?.trim() || null;
}

function onlyIfValid(phone: string | null): string | null {
  return phone && whatsappDigits(phone) ? phone : null;
}

function amountLabel(amount: number, currency: string): string {
  return currency.toUpperCase() === "CLP"
    ? formatClp(amount)
    : `${amount} ${currency.toUpperCase()}`;
}

function planLabel(key: string | null | undefined): string | null {
  return findPlan(key)?.label ?? null;
}

export type Draft = Omit<Followup, "id" | "priority" | "score"> & {
  refId: string;
  ageDays: number;
};

export function finalize(d: Draft): Followup {
  const { refId, ageDays, ...rest } = d;
  const bonus = Math.min(Math.max(ageDays, 0), MAX_AGE_BONUS);
  return {
    ...rest,
    id: `${d.kind}:${refId}`,
    priority: PRIORITY[d.kind],
    score: BASE_SCORE[d.kind] + bonus,
  };
}

// ------------------------------------------------------------------ propuestas

function proposalFollowup(p: ProposalInput, ctx: Context): Draft | null {
  if (!OPEN_PROPOSAL_STATES.has(p.status)) return null;
  if (p.expires_at && Date.parse(p.expires_at) <= ctx.nowMs) return null; // ya expirada

  const client = p.client_id ? ctx.clientById.get(p.client_id) : undefined;
  const prospect = p.prospect_id ? ctx.prospectById.get(p.prospect_id) : undefined;
  if (prospect && !isContactable(prospect, ctx.today)) return null;

  const businessName = client?.name ?? prospect?.nombre ?? p.title ?? "tu negocio";
  const phone = client ? clientPhone(ctx, client.id) : prospect ? prospectPhone(prospect) : null;
  const expiresYmd = chileYmd(p.expires_at);
  const daysToExpire = expiresYmd ? daysBetween(ctx.today, expiresYmd) : null;
  const seenYmd = chileYmd(p.viewed_at);
  const sentYmd = chileYmd(p.sent_at);

  let kind: FollowupKind;
  let reason: string;
  let ageDays: number;
  if (daysToExpire !== null && daysToExpire <= THRESHOLDS.proposalExpiringDays) {
    kind = "propuesta_por_vencer";
    reason = `La propuesta vence ${dueLabel(daysToExpire)} y aún no la aceptan.`;
    ageDays = THRESHOLDS.proposalExpiringDays - daysToExpire;
  } else if (seenYmd || p.status === "vista") {
    const since = daysBetween(seenYmd ?? sentYmd ?? ctx.today, ctx.today);
    if (since < THRESHOLDS.proposalSeenDays) return null;
    kind = "propuesta_sin_respuesta";
    reason = `La vieron ${ago(since)} y no la han aceptado.`;
    ageDays = since - THRESHOLDS.proposalSeenDays;
  } else {
    if (!sentYmd) return null;
    const since = daysBetween(sentYmd, ctx.today);
    if (since < THRESHOLDS.proposalUnseenDays) return null;
    kind = "propuesta_no_vista";
    reason = `Enviada ${ago(since)} y todavía no la abren.`;
    ageDays = since - THRESHOLDS.proposalUnseenDays;
  }

  return {
    refId: p.id,
    ageDays,
    kind,
    reason,
    businessName,
    clientId: p.client_id,
    prospectId: p.prospect_id,
    target: { screen: "proposal", proposalId: p.id },
    link: { kind: "path", path: `/p/${p.token}` },
    template: {
      kind,
      businessName,
      offerName: p.title?.trim() || planLabel(p.plan_key),
      amountLabel: p.amount_clp > 0 ? formatClp(p.amount_clp) : null,
      dateLabel: expiresYmd ? longDateLabel(expiresYmd) : null,
      periodLabel: null,
    },
    whatsappPhone: onlyIfValid(phone),
    recordsProspectContact: false,
  };
}

// ------------------------------------------------------------------ prospectos

function prospectFollowup(
  p: ProspectInput,
  ctx: Context,
  withOpenProposal: ReadonlySet<string>,
): Draft | null {
  if (!isContactable(p, ctx.today) || withOpenProposal.has(p.id)) return null;
  const isCold = p.estado === "contactado";
  const isWarm = p.estado === "respondio" || p.estado === "demo";
  if (!isCold && !isWarm) return null;

  // Sin fecha de contacto registrada se usa la última modificación del prospecto.
  const last = chileYmd(p.ultimo_contacto) ?? chileYmd(p.updated_at);
  if (!last) return null;
  const since = daysBetween(last, ctx.today);
  const threshold = isCold ? THRESHOLDS.contactedDays : THRESHOLDS.warmDays;
  if (since < threshold) return null;

  const kind: FollowupKind = isCold ? "prospecto_sin_respuesta" : "prospecto_sin_avance";
  const reason = isCold
    ? `Contactado ${ago(since)} y sin respuesta.`
    : `${p.estado === "demo" ? "En demo" : "Respondió"} y sin avance ${ago(since)}.`;
  return {
    refId: p.id,
    ageDays: since - threshold,
    kind,
    reason,
    businessName: p.nombre,
    clientId: p.client_id ?? null,
    prospectId: p.id,
    target: { screen: "prospect", prospectId: p.id },
    link: null,
    template: {
      kind,
      businessName: p.nombre,
      offerName: planLabel(p.producto_sugerido),
      amountLabel: null,
      dateLabel: null,
      periodLabel: null,
    },
    // "contactado" nunca respondió: prospectPhone devuelve null (nada de WhatsApp en frío).
    whatsappPhone: onlyIfValid(prospectPhone(p)),
    recordsProspectContact: true,
  };
}

// ------------------------------------------------------------------ cobros

function paymentFollowup(p: PaymentInput, ctx: Context): Draft | null {
  const due = chileYmd(p.due_date);
  const overdue =
    p.status === "overdue" ||
    (p.status === "pending" && Boolean(due) && (due as string) < ctx.today);
  const soon =
    !overdue &&
    p.status === "pending" &&
    Boolean(due) &&
    daysBetween(ctx.today, due as string) >= 0 &&
    daysBetween(ctx.today, due as string) <= THRESHOLDS.paymentDueSoonDays;
  if (!overdue && !soon) return null;

  const client = ctx.clientById.get(p.client_id);
  const businessName = client?.name ?? "Cliente";
  const kind: FollowupKind = overdue ? "cobro_vencido" : "cobro_por_vencer";
  const lateDays = due ? daysBetween(due, ctx.today) : 0;
  const reason = overdue
    ? due
      ? `Cobro vencido ${ago(Math.max(lateDays, 0))}.`
      : "Cobro marcado como vencido."
    : `Cobro vence ${dueLabel(daysBetween(ctx.today, due as string))}.`;
  return {
    refId: p.id,
    ageDays: overdue ? lateDays : 0,
    kind,
    reason,
    businessName,
    clientId: p.client_id,
    prospectId: null,
    target: { screen: "client_payments", clientId: p.client_id },
    link: p.payment_url ? { kind: "absolute", url: p.payment_url } : null,
    template: {
      kind,
      businessName,
      offerName: p.description?.trim() || planLabel(ctx.billingByClient.get(p.client_id)?.plan_key),
      amountLabel: amountLabel(p.amount, p.currency),
      dateLabel: due ? longDateLabel(due) : null,
      periodLabel: null,
    },
    whatsappPhone: onlyIfValid(clientPhone(ctx, p.client_id)),
    recordsProspectContact: false,
  };
}

// ------------------------------------------------------------------ onboarding

function onboardingFollowup(b: BillingInput, ctx: Context): Draft | null {
  if (!b.onboarding_token) return null;
  if (!b.onboarding_token_expires_at || Date.parse(b.onboarding_token_expires_at) <= ctx.nowMs)
    return null;
  if (ctx.intakeByClient.has(b.client_id)) return null; // client_intake existe = ya lo envió
  const client = ctx.clientById.get(b.client_id);
  if (!client || INACTIVE_CLIENT_STATES.has(client.status)) return null;

  // client_billing no guarda cuándo se generó el link: se usa el inicio del cliente.
  const start = chileYmd(client.started_at) ?? chileYmd(client.created_at);
  if (!start) return null;
  const since = daysBetween(start, ctx.today);
  if (since < THRESHOLDS.onboardingDays) return null;

  const kind: FollowupKind = "onboarding_pendiente";
  return {
    refId: b.client_id,
    ageDays: since - THRESHOLDS.onboardingDays,
    kind,
    reason: `Cliente nuevo ${ago(since)} y aún no completa el onboarding.`,
    businessName: client.name,
    clientId: client.id,
    prospectId: null,
    target: { screen: "client", clientId: client.id },
    link: { kind: "path", path: `/onboarding/${b.onboarding_token}` },
    template: {
      kind,
      businessName: client.name,
      offerName: planLabel(b.plan_key),
      amountLabel: null,
      dateLabel: null,
      periodLabel: null,
    },
    whatsappPhone: onlyIfValid(clientPhone(ctx, client.id)),
    recordsProspectContact: false,
  };
}

// ------------------------------------------------------------------ reportes

function reportFollowup(r: ReportInput, ctx: Context, period: string): Draft | null {
  if (r.sent_at || r.period.slice(0, 10) !== period) return null;
  const client = ctx.clientById.get(r.client_id);
  if (!client || client.status === "terminado") return null;
  const kind: FollowupKind = "reporte_sin_enviar";
  const month = monthLabel(period);
  return {
    refId: r.id,
    ageDays: daysBetween(`${ctx.today.slice(0, 7)}-01`, ctx.today),
    kind,
    reason: `El reporte de ${month} está generado y no se ha enviado.`,
    businessName: client.name,
    clientId: client.id,
    prospectId: null,
    target: { screen: "client", clientId: client.id },
    link: { kind: "path", path: `/r/${r.token}` },
    template: {
      kind,
      businessName: client.name,
      offerName: null,
      amountLabel: null,
      dateLabel: null,
      periodLabel: month,
    },
    whatsappPhone: onlyIfValid(clientPhone(ctx, client.id)),
    recordsProspectContact: false,
  };
}

// ------------------------------------------------------------------ entrada principal

function byPriority(a: Followup, b: Followup): number {
  return (
    b.score - a.score ||
    a.businessName.localeCompare(b.businessName, "es") ||
    a.id.localeCompare(b.id)
  );
}

/** Lista priorizada de seguimientos para `now` (hora de Chile). */
export function computeFollowups(src: FollowupSources, now: Date = new Date()): Followup[] {
  const ctx = buildContext(src, now);
  const proposalDrafts = src.proposals.map((p) => proposalFollowup(p, ctx));

  // Prospectos con una propuesta abierta vigente: el seguimiento va por la propuesta.
  const withOpenProposal = new Set(
    src.proposals
      .filter(
        (p) =>
          OPEN_PROPOSAL_STATES.has(p.status) &&
          !(p.expires_at && Date.parse(p.expires_at) <= ctx.nowMs),
      )
      .map((p) => p.prospect_id)
      .filter((id): id is string => Boolean(id)),
  );
  const period = closedPeriod(ctx.today);

  const drafts = [
    ...proposalDrafts,
    ...src.prospects.map((p) => prospectFollowup(p, ctx, withOpenProposal)),
    ...src.payments.map((p) => paymentFollowup(p, ctx)),
    ...src.billing.map((b) => onboardingFollowup(b, ctx)),
    ...src.reports.map((r) => reportFollowup(r, ctx, period)),
  ].filter((d): d is Draft => d !== null);

  return drafts.map(finalize).sort(byPriority);
}

/** Seguimientos de un cliente o de un prospecto (fichas). */
export function followupsFor(
  items: readonly Followup[],
  scope: { clientId?: string | null; prospectId?: string | null },
): Followup[] {
  return items.filter(
    (f) =>
      (scope.clientId != null && f.clientId === scope.clientId) ||
      (scope.prospectId != null && f.prospectId === scope.prospectId),
  );
}

/** Une el origen con una ruta pública o devuelve la URL absoluta. */
export function resolveLink(link: Followup["link"], origin: string): string | null {
  if (!link) return null;
  if (link.kind === "absolute") return /^https?:\/\//i.test(link.url) ? link.url : null;
  return `${origin.replace(/\/$/, "")}${link.path}`;
}
