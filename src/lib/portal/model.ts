/**
 * Modelo del portal del cliente (v2). Lógica pura, sin React ni Supabase,
 * compartida por el servidor (portal.server.ts) y los componentes.
 *
 * Regla de oro: todo lo que sale de aquí lo ve el cliente. Nada de MRR,
 * notas internas, client_billing ni datos de otros clientes.
 */
import { todayInChile } from "@/lib/billing/dates";
import { findPlan } from "@/lib/pricing/plans";
import { fmtInt, fmtPct, relativeChange } from "@/lib/reports/format";
import type { Metric, MonthlyReportData } from "@/lib/reports/types";

/* ───────────────────────── Tipos que viajan al navegador ───────────────────────── */

/** Resultado de una sección: si una falla, las demás se muestran igual. */
export type SectionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PortalReviewComment {
  id: string;
  kind: "comment" | "approval" | "change_request";
  body: string;
  authorRole: "agency" | "client" | "guest";
  authorName: string | null;
  createdAt: string;
}

export interface PortalDeliverableReview {
  id: string;
  title: string;
  description: string | null;
  type: string;
  dueDate: string | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  comments: PortalReviewComment[];
}

export interface PortalPostReview {
  id: string;
  caption: string | null;
  format: "photo" | "carousel" | "reel";
  imageUrl: string | null;
  scheduledAt: string | null;
}

export interface PortalApprovals {
  deliverables: PortalDeliverableReview[];
  posts: PortalPostReview[];
}

export interface KeyFigure {
  label: string;
  value: string;
  /** Comparación con el mes anterior en lenguaje simple (o null). */
  detail: string | null;
  trend: "up" | "down" | "flat" | null;
}

export interface PortalReport {
  period: string;
  token: string;
  summary: string | null;
  figures: KeyFigure[];
}

export type PortalPaymentStatus = "pending" | "overdue" | "paid" | "cancelled";

export interface PortalPayment {
  id: string;
  amount: number;
  currency: string | null;
  status: PortalPaymentStatus;
  dueDate: string | null;
  period: string | null;
  paymentUrl: string | null;
  documentType: string | null;
}

export interface PortalPlan {
  label: string;
  amountClp: number;
  interval: string;
  nextChargeDate: string | null;
}

export interface PortalBilling {
  plan: PortalPlan | null;
  /** Pendientes y vencidos, el más urgente primero. */
  open: PortalPayment[];
  /** Últimos pagados (historial corto). */
  recentPaid: PortalPayment[];
}

export interface PortalProposal {
  id: string;
  title: string;
  amountClp: number;
  status: string;
  sentAt: string | null;
  expiresAt: string | null;
  token: string;
}

export interface PortalSnapshot {
  clientId: string;
  clientName: string;
  approvals: SectionResult<PortalApprovals>;
  report: SectionResult<PortalReport | null>;
  billing: SectionResult<PortalBilling>;
  proposals: SectionResult<PortalProposal[]>;
}

export type PortalSnapshotResult =
  { status: "ok"; snapshot: PortalSnapshot } | { status: "no_client" };

export interface CalendarPost {
  id: string;
  caption: string | null;
  format: "photo" | "carousel" | "reel";
  scheduledAt: string;
  approvalStatus: string | null;
}

export interface CalendarDeliverable {
  id: string;
  title: string;
  status: string;
  type: string;
  dueDate: string;
}

export interface PortalCalendar {
  month: string;
  posts: CalendarPost[];
  deliverables: CalendarDeliverable[];
}

export type PortalDecision = "approve" | "changes";
export type PortalItemKind = "deliverable" | "post";

export type DecisionResult = { ok: true; noteSaved: boolean } | { ok: false; reason: "stale" };

/** Cantidad de ítems esperando el OK del cliente (0 si la sección falló o carga). */
export function pendingCount(result: SectionResult<PortalApprovals> | undefined): number {
  return result?.ok ? result.data.deliverables.length + result.data.posts.length : 0;
}

/* ───────────────────────── Constantes ───────────────────────── */

export const NOTE_MAX_LENGTH = 2000;
export const NOTE_MIN_LENGTH = 3;
export const DEFAULT_APPROVAL_NOTE = "Aprobado desde el portal ✓";
export const KEY_FIGURES_COUNT = 3;
export const RECENT_PAID_COUNT = 3;
/** Variaciones menores se consideran "estables" (igual que el resumen del reporte). */
const STABLE_THRESHOLD = 0.05;

export const POST_FORMAT_LABEL: Readonly<Record<CalendarPost["format"], string>> = {
  photo: "Foto",
  carousel: "Carrusel",
  reel: "Reel",
};

export const DELIVERABLE_TYPE_LABEL: Readonly<Record<string, string>> = {
  post: "Post",
  reel: "Reel",
  story: "Historia",
  design: "Diseño",
  meeting: "Reunión",
  report: "Informe",
  other: "Entrega",
};

export const PAYMENT_STATUS_META: Readonly<
  Record<PortalPaymentStatus, { label: string; tone: "warning" | "danger" | "success" | "neutral" }>
> = {
  pending: { label: "Por pagar", tone: "warning" },
  overdue: { label: "Vencido", tone: "danger" },
  paid: { label: "Pagado", tone: "success" },
  cancelled: { label: "Anulado", tone: "neutral" },
};

/* ───────────────────────── Fechas ───────────────────────── */

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])-01$/;

export function isMonth(value: string): boolean {
  return MONTH_RE.test(value);
}

/** Mes actual en Chile como "YYYY-MM-01". */
export function currentMonth(now: Date = new Date()): string {
  return `${todayInChile(now).slice(0, 7)}-01`;
}

export function shiftMonth(month: string, delta: number): string {
  const m = MONTH_RE.exec(month);
  if (!m) throw new Error(`Mes inválido: ${month}`);
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

const MONTH_TITLE = new Intl.DateTimeFormat("es-CL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10-01" → "Octubre 2026". */
export function monthTitle(month: string): string {
  const m = MONTH_RE.exec(month);
  if (!m) return month;
  const text = MONTH_TITLE.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))).replace(
    " de ",
    " ",
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const DAY_FMT = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const DATETIME_FMT = new Intl.DateTimeFormat("es-CL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Santiago",
});
const DAY_KEY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" });

/** Fecha "YYYY-MM-DD" (columna date) → "5 oct". */
export function formatShortDate(isoDate: string | null): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return "Sin fecha";
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return DAY_FMT.format(new Date(Date.UTC(y, m - 1, d)));
}

/** Instante → "lun, 5 oct, 18:30" en hora de Chile. */
export function formatDateTime(instant: string | null): string {
  if (!instant) return "Sin fecha";
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : DATETIME_FMT.format(date);
}

const TIME_FMT = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Santiago",
});

/** Instante → "18:30" en hora de Chile. */
export function formatTime(instant: string): string {
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? "" : TIME_FMT.format(date);
}

/** Instante → "YYYY-MM-DD" en hora de Chile (para agrupar por día). */
export function chileDayKey(instant: string): string {
  return DAY_KEY_FMT.format(new Date(instant));
}

/* ───────────────────────── Calendario ───────────────────────── */

export type CalendarEntry =
  | { kind: "post"; day: string; post: CalendarPost }
  | { kind: "deliverable"; day: string; deliverable: CalendarDeliverable };

export interface CalendarDay {
  day: string;
  entries: CalendarEntry[];
}

/** Junta posts y entregas del mes y los agrupa por día (orden cronológico). */
export function groupCalendar(calendar: PortalCalendar): CalendarDay[] {
  const entries: CalendarEntry[] = [
    ...calendar.posts.map((post): CalendarEntry => ({
      kind: "post",
      day: chileDayKey(post.scheduledAt),
      post,
    })),
    ...calendar.deliverables.map((deliverable): CalendarEntry => ({
      kind: "deliverable",
      day: deliverable.dueDate.slice(0, 10),
      deliverable,
    })),
  ];
  const byDay = entries.reduce<Map<string, CalendarEntry[]>>((acc, entry) => {
    acc.set(entry.day, [...(acc.get(entry.day) ?? []), entry]);
    return acc;
  }, new Map());
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => ({ day, entries: list }));
}

/* ───────────────────────── Resultados ───────────────────────── */

interface FigureSource {
  label: string;
  metric: Metric | null | undefined;
}

function trendOf(ratio: number | null): KeyFigure["trend"] {
  if (ratio == null) return null;
  if (Math.abs(ratio) < STABLE_THRESHOLD) return "flat";
  return ratio > 0 ? "up" : "down";
}

function describeChange(ratio: number | null): string | null {
  const trend = trendOf(ratio);
  if (trend == null || ratio == null) return null;
  if (trend === "flat") return "Igual que el mes anterior";
  return `${trend === "up" ? "Subió" : "Bajó"} ${fmtPct(ratio)} vs. el mes anterior`;
}

function fromMetric({ label, metric }: FigureSource): KeyFigure | null {
  if (!metric || metric.value <= 0) return null;
  const ratio = relativeChange(metric.value, metric.previous);
  return {
    label,
    value: fmtInt(metric.value),
    detail: describeChange(ratio),
    trend: trendOf(ratio),
  };
}

function followersFigure(data: MonthlyReportData): KeyFigure | null {
  const followers = data.instagram?.followers;
  if (!followers || followers.net_change == null || followers.net_change === 0) return null;
  const gained = followers.net_change > 0;
  return {
    label: gained ? "Seguidores nuevos en Instagram" : "Seguidores perdidos en Instagram",
    value: fmtInt(Math.abs(followers.net_change)),
    detail: `Ahora tienes ${fmtInt(followers.value)} seguidores`,
    trend: gained ? "up" : "down",
  };
}

/**
 * Las 3 cifras más útiles del reporte, en lenguaje simple. Prioriza lo que
 * más le importa a un negocio (contactos) sobre métricas de vanidad.
 */
export function pickKeyFigures(data: MonthlyReportData): KeyFigure[] {
  const candidates: (KeyFigure | null)[] = [
    fromMetric({ label: "Personas que te contactaron", metric: data.leads?.total }),
    followersFigure(data),
    fromMetric({ label: "Veces que vieron tus publicaciones", metric: data.instagram?.post_views }),
    fromMetric({ label: "Visitas a tu web", metric: data.landing?.visits }),
    fromMetric({ label: "Clics para contactarte desde tu web", metric: data.landing?.contacts }),
    fromMetric({ label: "Reservas agendadas", metric: data.bookings?.total }),
    fromMetric({
      label: "Interacciones con tus publicaciones",
      metric: data.instagram?.interactions,
    }),
    data.deliverables && data.deliverables.completed > 0
      ? {
          label: "Entregas terminadas",
          value: fmtInt(data.deliverables.completed),
          detail: null,
          trend: null,
        }
      : null,
  ];
  return candidates.filter((f): f is KeyFigure => f !== null).slice(0, KEY_FIGURES_COUNT);
}

/* ───────────────────────── Pagos ───────────────────────── */

export interface RawPayment {
  id: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  due_date: string | null;
  period: string | null;
  payment_url: string | null;
  document_type: string | null;
}

const PAYMENT_STATUSES: readonly PortalPaymentStatus[] = [
  "pending",
  "overdue",
  "paid",
  "cancelled",
];

/** Un cobro pendiente con fecha pasada se muestra como vencido. */
export function effectivePaymentStatus(
  status: string | null,
  dueDate: string | null,
  today: string,
): PortalPaymentStatus {
  const known = PAYMENT_STATUSES.find((s) => s === status) ?? "pending";
  if (known === "pending" && dueDate && dueDate.slice(0, 10) < today) return "overdue";
  return known;
}

/** Solo enlaces https (evita javascript: u otros esquemas en un href). */
export function safeHttpsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function toPortalPayments(rows: readonly RawPayment[], today: string): PortalPayment[] {
  return rows.flatMap((row): PortalPayment[] => {
    if (!row.id) return [];
    return [
      {
        id: row.id,
        amount: Number(row.amount ?? 0),
        currency: row.currency,
        status: effectivePaymentStatus(row.status, row.due_date, today),
        dueDate: row.due_date,
        period: row.period,
        paymentUrl: safeHttpsUrl(row.payment_url),
        documentType: row.document_type,
      },
    ];
  });
}

/** Separa cobros abiertos (vencidos primero, luego por fecha) del historial pagado. */
export function splitPayments(
  payments: readonly PortalPayment[],
): Pick<PortalBilling, "open" | "recentPaid"> {
  const rank = (p: PortalPayment) => (p.status === "overdue" ? 0 : 1);
  const open = payments
    .filter((p) => p.status === "pending" || p.status === "overdue")
    .sort((a, b) => rank(a) - rank(b) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const recentPaid = payments
    .filter((p) => p.status === "paid")
    .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""))
    .slice(0, RECENT_PAID_COUNT);
  return { open, recentPaid };
}

export function planLabel(planKey: string | null | undefined): string {
  return findPlan(planKey)?.label ?? "Plan a medida";
}

export const INTERVAL_LABEL: Readonly<Record<string, string>> = {
  month: "al mes",
};

export function documentTypeLabel(value: string | null): string | null {
  if (!value) return null;
  const clean = value.replace(/_/g, " ").trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : null;
}
