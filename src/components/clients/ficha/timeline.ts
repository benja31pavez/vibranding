/**
 * Línea de tiempo de la ficha: convierte filas ya leídas (pagos, comentarios,
 * propuestas, contratos, reportes, onboarding, planes y archivos) en eventos
 * ordenados del más nuevo al más antiguo. Sin E/S ni React.
 */
import type { StatusTone } from "@/components/app";
import { periodLabel } from "@/lib/billing/dates";
import { findPlan, formatMoney } from "@/lib/pricing/plans";

export const TIMELINE_KINDS = [
  "pago",
  "aprobacion",
  "cambios",
  "mensaje",
  "propuesta_enviada",
  "propuesta_aceptada",
  "contrato",
  "reporte",
  "onboarding",
  "plan",
  "archivo",
] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export const TIMELINE_KIND_META: Readonly<
  Record<TimelineKind, { label: string; tone: StatusTone }>
> = {
  pago: { label: "Pago recibido", tone: "success" },
  aprobacion: { label: "Aprobación", tone: "success" },
  cambios: { label: "Cambios pedidos", tone: "warning" },
  mensaje: { label: "Mensaje del cliente", tone: "info" },
  propuesta_enviada: { label: "Propuesta enviada", tone: "neutral" },
  propuesta_aceptada: { label: "Propuesta aceptada", tone: "success" },
  contrato: { label: "Contrato firmado", tone: "success" },
  reporte: { label: "Reporte enviado", tone: "info" },
  onboarding: { label: "Onboarding recibido", tone: "info" },
  plan: { label: "Cambio de plan", tone: "warning" },
  archivo: { label: "Archivo adjunto", tone: "neutral" },
};

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: string;
  title: string;
  detail: string | null;
  by: string | null;
}

export interface TimelineSources {
  payments: readonly {
    id: string;
    amount: number;
    currency: string;
    description: string | null;
    period: string | null;
    paid_at: string | null;
  }[];
  comments: readonly {
    id: string;
    kind: string;
    body: string;
    author_name: string | null;
    created_at: string;
    deliverables: { title: string } | null;
  }[];
  approvedPosts: readonly { id: string; caption: string | null; approved_at: string | null }[];
  proposals: readonly {
    id: string;
    title: string | null;
    amount_clp: number;
    sent_at: string | null;
    accepted_at: string | null;
    accepted_name: string | null;
  }[];
  contracts: readonly { id: string; title: string; signed_at: string | null }[];
  reports: readonly { id: string; period: string; sent_at: string | null }[];
  intake: {
    submitted_at: string;
    contacto_nombre: string | null;
    archivos: readonly string[];
  } | null;
  subscriptions: readonly {
    id: string;
    plan_key: string;
    started_at: string | null;
    cancelled_at: string | null;
  }[];
  files: readonly { id: string; title: string; file_name: string | null; created_at: string }[];
}

const SNIPPET_CHARS = 90;

function snippet(text: string | null | undefined): string | null {
  const clean = text?.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > SNIPPET_CHARS ? `${clean.slice(0, SNIPPET_CHARS)}…` : clean;
}

function planName(key: string): string {
  return findPlan(key)?.label ?? key;
}

function commentEvent(c: TimelineSources["comments"][number]): TimelineEvent {
  const piece = c.deliverables?.title ?? null;
  const kind: TimelineKind =
    c.kind === "approval" ? "aprobacion" : c.kind === "change_request" ? "cambios" : "mensaje";
  return {
    id: `comment-${c.id}`,
    kind,
    at: c.created_at,
    title: TIMELINE_KIND_META[kind].label,
    detail: kind === "mensaje" ? (snippet(c.body) ?? piece) : piece,
    by: c.author_name?.trim() || null,
  };
}

function proposalEvents(p: TimelineSources["proposals"][number]): TimelineEvent[] {
  const name = p.title?.trim() || "Propuesta";
  const detail = p.amount_clp > 0 ? `${name} · ${formatMoney(p.amount_clp)}` : name;
  const events: TimelineEvent[] = [];
  if (p.sent_at) {
    events.push({
      id: `proposal-sent-${p.id}`,
      kind: "propuesta_enviada",
      at: p.sent_at,
      title: TIMELINE_KIND_META.propuesta_enviada.label,
      detail,
      by: null,
    });
  }
  if (p.accepted_at) {
    events.push({
      id: `proposal-accepted-${p.id}`,
      kind: "propuesta_aceptada",
      at: p.accepted_at,
      title: TIMELINE_KIND_META.propuesta_aceptada.label,
      detail,
      by: p.accepted_name?.trim() || null,
    });
  }
  return events;
}

function planEvents(s: TimelineSources["subscriptions"][number]): TimelineEvent[] {
  const name = planName(s.plan_key);
  const events: TimelineEvent[] = [];
  if (s.started_at) {
    events.push({
      id: `plan-start-${s.id}`,
      kind: "plan",
      at: s.started_at,
      title: TIMELINE_KIND_META.plan.label,
      detail: `${name} activado`,
      by: null,
    });
  }
  if (s.cancelled_at) {
    events.push({
      id: `plan-cancel-${s.id}`,
      kind: "plan",
      at: s.cancelled_at,
      title: TIMELINE_KIND_META.plan.label,
      detail: `${name} cancelado`,
      by: null,
    });
  }
  return events;
}

function simple(
  kind: TimelineKind,
  id: string,
  at: string | null,
  detail: string | null,
  by: string | null = null,
): TimelineEvent[] {
  return at ? [{ id, kind, at, title: TIMELINE_KIND_META[kind].label, detail, by }] : [];
}

/** Todos los eventos, del más reciente al más antiguo (los de fecha inválida se descartan). */
export function buildTimeline(src: TimelineSources): TimelineEvent[] {
  const archivos = src.intake?.archivos.length ?? 0;
  const events: TimelineEvent[] = [
    ...src.payments.flatMap((p) =>
      simple(
        "pago",
        `payment-${p.id}`,
        p.paid_at,
        [
          formatMoney(Number(p.amount)),
          snippet(p.description) ?? (p.period && periodLabel(p.period)),
        ]
          .filter(Boolean)
          .join(" · "),
      ),
    ),
    ...src.comments.map(commentEvent),
    ...src.approvedPosts.flatMap((p) =>
      simple(
        "aprobacion",
        `post-${p.id}`,
        p.approved_at,
        `Post de Instagram${p.caption?.trim() ? `: ${snippet(p.caption)}` : ""}`,
      ),
    ),
    ...src.proposals.flatMap(proposalEvents),
    ...src.contracts.flatMap((c) => simple("contrato", `contract-${c.id}`, c.signed_at, c.title)),
    ...src.reports.flatMap((r) =>
      simple("reporte", `report-${r.id}`, r.sent_at, `Resultados de ${periodLabel(r.period)}`),
    ),
    ...(src.intake
      ? simple(
          "onboarding",
          "intake",
          src.intake.submitted_at,
          archivos > 0
            ? `Formulario completo · ${archivos} archivo${archivos === 1 ? "" : "s"}`
            : "Formulario completo",
          src.intake.contacto_nombre?.trim() || null,
        )
      : []),
    ...src.subscriptions.flatMap(planEvents),
    ...src.files.flatMap((f) =>
      simple("archivo", `file-${f.id}`, f.created_at, f.title || f.file_name),
    ),
  ];
  return events
    .filter((e) => !Number.isNaN(new Date(e.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

const WEEK_DAYS = 6;
const DAY_MS = 86_400_000;
const TIME_ZONE = "America/Santiago";

function chileParts(date: Date) {
  const ymd = date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
  const time = date.toLocaleTimeString("es-CL", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { ymd, time };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Hoy, 11:24" · "Ayer, 16:40" · "Lun, 14:22" (última semana) · "4 sept" · "4 sept 2025". */
export function relativeStamp(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const { ymd, time } = chileParts(date);
  const today = chileParts(now).ymd;
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${ymd}T00:00:00Z`)) / DAY_MS,
  );
  if (days === 0) return `Hoy, ${time}`;
  if (days === 1) return `Ayer, ${time}`;
  if (days > 1 && days <= WEEK_DAYS) {
    const weekday = date
      .toLocaleDateString("es-CL", { timeZone: TIME_ZONE, weekday: "short" })
      .replace(".", "");
    return `${capitalize(weekday)}, ${time}`;
  }
  const sameYear = ymd.slice(0, 4) === today.slice(0, 4);
  return date
    .toLocaleDateString("es-CL", {
      timeZone: TIME_ZONE,
      day: "numeric",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" }),
    })
    .replace(".", "");
}
