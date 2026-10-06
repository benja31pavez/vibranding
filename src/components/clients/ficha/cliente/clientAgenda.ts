/**
 * Lógica pura de "Pendientes contigo" y "Esta semana" del Resumen del cliente:
 * qué tiene que hacer el cliente y qué pasa en los próximos 7 días (hora de
 * Chile). Sin E/S ni React.
 */
import { addDaysYmd, chileDate } from "@/lib/dates/chile";
import type {
  PortalApprovals,
  PortalBilling,
  PortalCalendar,
  PortalPayment,
} from "@/lib/portal/model";

/** Días que cubre "Esta semana" (hoy incluido). */
export const WEEK_DAYS = 7;

/** Destinos del entorno del cliente (nunca páginas exclusivas de la agencia). */
export type AgendaTarget =
  | { kind: "deliverables" }
  | { kind: "instagram" }
  | { kind: "payments" }
  | { kind: "legal" }
  | { kind: "external"; href: string };

export type PendingKind = "deliverable" | "post" | "payment" | "onboarding" | "contract";

export interface PendingItem {
  id: string;
  kind: PendingKind;
  title: string;
  /** "YYYY-MM-DD" o instante ISO; null si no aplica. */
  date: string | null;
  overdue?: boolean;
  action: string;
  target: AgendaTarget | null;
}

export type WeekKind = "post" | "reel" | "deliverable" | "payment";

export interface WeekItem {
  id: string;
  kind: WeekKind;
  title: string;
  /** "YYYY-MM-DD" en Chile. */
  ymd: string;
}

const TITLE_CHARS = 60;

function shorten(text: string | null | undefined, fallback: string): string {
  const clean = text?.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > TITLE_CHARS ? `${clean.slice(0, TITLE_CHARS)}…` : clean;
}

function paymentTitle(p: PortalPayment): string {
  return p.status === "overdue" ? "Pago vencido" : "Pago por hacer";
}

function paymentTarget(p: PortalPayment): AgendaTarget {
  return p.paymentUrl ? { kind: "external", href: p.paymentUrl } : { kind: "payments" };
}

export interface PendingInput {
  approvals: PortalApprovals | null;
  billing: PortalBilling | null;
  /** Cliente en etapa de onboarding (aún no termina el formulario). */
  onboardingPending: boolean;
  /** Link público vigente del formulario de onboarding. */
  onboardingUrl: string | null;
  /** Contrato enviado y sin firmar. */
  contractToSign: { title: string } | null;
}

/** Lo que el cliente tiene que hacer para que avancemos, lo más urgente primero. */
export function pendingWithClient(input: PendingInput): PendingItem[] {
  const items: PendingItem[] = [];
  if (input.onboardingPending) {
    items.push({
      id: "onboarding",
      kind: "onboarding",
      title: "Completar el formulario de inicio",
      date: null,
      action: "Completar",
      target: input.onboardingUrl ? { kind: "external", href: input.onboardingUrl } : null,
    });
  }
  for (const p of input.billing?.open ?? []) {
    items.push({
      id: `payment-${p.id}`,
      kind: "payment",
      title: paymentTitle(p),
      date: p.dueDate,
      overdue: p.status === "overdue",
      action: p.paymentUrl ? "Pagar" : "Ver",
      target: paymentTarget(p),
    });
  }
  if (input.contractToSign) {
    items.push({
      id: "contract",
      kind: "contract",
      title: `Firmar ${shorten(input.contractToSign.title, "el contrato")}`,
      date: null,
      action: "Ver",
      target: { kind: "legal" },
    });
  }
  for (const d of input.approvals?.deliverables ?? []) {
    items.push({
      id: `deliverable-${d.id}`,
      kind: "deliverable",
      title: `Aprobar ${shorten(d.title, "una entrega")}`,
      date: d.dueDate,
      action: "Revisar",
      target: { kind: "deliverables" },
    });
  }
  for (const p of input.approvals?.posts ?? []) {
    items.push({
      id: `post-${p.id}`,
      kind: "post",
      title: `Aprobar ${shorten(p.caption, "una publicación")}`,
      date: p.scheduledAt,
      action: "Revisar",
      target: { kind: "instagram" },
    });
  }
  return items;
}

function inWeek(ymd: string | null, today: string): ymd is string {
  if (!ymd) return false;
  return ymd >= today && ymd <= addDaysYmd(today, WEEK_DAYS - 1);
}

/** Meses ("YYYY-MM-01") que toca la semana desde `today`. */
export function weekMonths(today: string): string[] {
  const first = `${today.slice(0, 7)}-01`;
  const last = `${addDaysYmd(today, WEEK_DAYS - 1).slice(0, 7)}-01`;
  return first === last ? [first] : [first, last];
}

/** Posts programados, entregas con fecha y cobros que vencen en los próximos 7 días. */
export function weekAgenda(
  calendars: readonly PortalCalendar[],
  billing: PortalBilling | null,
  today: string,
): WeekItem[] {
  const items: WeekItem[] = [];
  const seen = new Set<string>();
  const push = (item: WeekItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };
  for (const cal of calendars) {
    for (const p of cal.posts) {
      const ymd = chileDate(new Date(p.scheduledAt));
      if (!inWeek(ymd, today)) continue;
      push({
        id: `post-${p.id}`,
        kind: p.format === "reel" ? "reel" : "post",
        title: shorten(p.caption, p.format === "reel" ? "Reel programado" : "Post programado"),
        ymd,
      });
    }
    for (const d of cal.deliverables) {
      const ymd = d.dueDate.slice(0, 10);
      if (!inWeek(ymd, today)) continue;
      push({
        id: `deliverable-${d.id}`,
        kind: "deliverable",
        title: shorten(d.title, "Entrega"),
        ymd,
      });
    }
  }
  for (const p of billing?.open ?? []) {
    const ymd = p.dueDate?.slice(0, 10) ?? null;
    if (!inWeek(ymd, today)) continue;
    push({ id: `payment-${p.id}`, kind: "payment", title: "Vence un pago", ymd });
  }
  return items.sort((a, b) => a.ymd.localeCompare(b.ymd));
}

const WEEKDAY = new Intl.DateTimeFormat("es-CL", { weekday: "short", timeZone: "UTC" });

/** "Hoy", "Mañana" o "Jue 9". */
export function dayLabel(ymd: string, today: string): string {
  if (ymd === today) return "Hoy";
  if (ymd === addDaysYmd(today, 1)) return "Mañana";
  const [y, m, d] = ymd.split("-").map(Number);
  const weekday = WEEKDAY.format(new Date(Date.UTC(y, m - 1, d))).replace(".", "");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${d}`;
}
