/**
 * "Resumen para reunión": arma, a partir de filas ya leídas de la BD, un brief
 * listo para leer antes de una llamada con el cliente (últimos 30 días).
 *
 * - Sin E/S ni React: se prueba con datos falsos y `today` fijo (scripts/check-briefing.mjs).
 * - Fechas de calendario en America/Santiago (las consultas traen un día de margen
 *   y aquí se filtra exacto).
 * - Nunca inventa cifras: sin filas de campañas dice "Sin datos de campañas";
 *   si los datos vinieron truncados, no muestra totales.
 * - Solo CLP: montos en otra moneda se dejan fuera con aviso.
 */
import { addDaysYmd } from "@/lib/dates/chile";
import { HEALTH_LEVEL_META, daysBetween, toYmd } from "@/lib/health/score";
import type { HealthLevel, HealthReason } from "@/lib/health/types";
import { EMPTY_CLP_TOTALS, addClp, formatClpTotals, type ClpTotals } from "@/lib/pricing/plans";

export const BRIEF_WINDOW_DAYS = 30;
export const BRIEF_NEXT_DAYS = 14;
/** Máximo de ítems listados por bloque (el resto se resume como "y N más"). */
export const BRIEF_MAX_ITEMS = 5;
export const NO_CAMPAIGN_DATA = "Sin datos de campañas";

// ------------------------------------------------------------------ entradas

export interface BriefHealthInput {
  level: HealthLevel;
  reasons: readonly Pick<HealthReason, "code" | "label" | "severity">[];
}

export interface BriefDeliverable {
  title: string;
  type: string;
  status: string;
  updated_at: string;
  due_date: string | null;
}

export interface BriefPost {
  approved_at: string | null;
  published_at: string | null;
  scheduled_at: string | null;
}

export interface BriefTask {
  title: string;
  status: string;
  due_date: string | null;
  updated_at: string;
}

export interface BriefReport {
  period: string;
  sent_at: string | null;
}

export interface BriefApproval {
  kind: string | null;
  title: string | null;
  created_at: string | null;
}

export interface BriefPayment {
  amount: number;
  currency: string | null;
  status: string;
  due_date: string | null;
  description: string | null;
}

export interface BriefMetaRow {
  date: string;
  spend: number;
  currency: string | null;
  messaging_conversations_started: number;
}

export interface BriefGoogleRow {
  date: string;
  cost_clp: number;
  conversions: number;
}

export interface MeetingBriefInput {
  clientName: string;
  /** Hoy en Chile ("YYYY-MM-DD"). */
  today: string;
  /** null = el cliente no se puntúa (prospecto/terminado) o no se pudo calcular. */
  health: BriefHealthInput | null;
  /** La salud no se pudo calcular (error de carga). */
  healthError?: boolean;
  deliverables: readonly BriefDeliverable[];
  posts: readonly BriefPost[];
  tasks: readonly BriefTask[];
  reports: readonly BriefReport[];
  approvals: readonly BriefApproval[];
  payments: readonly BriefPayment[];
  /** true si ya envió el formulario de onboarding; null si no aplica. */
  intakeSubmitted: boolean | null;
  meta: readonly BriefMetaRow[];
  google: readonly BriefGoogleRow[];
  /** Alguna consulta de campañas llegó a su tope: no se muestran totales. */
  campaignsTruncated: boolean;
}

// ------------------------------------------------------------------ salida

export type BriefSectionKey =
  "estado" | "hicimos" | "resultados" | "pendientes" | "proximos" | "preguntas";

export interface BriefSection {
  key: BriefSectionKey;
  title: string;
  lines: string[];
}

export interface MeetingBrief {
  title: string;
  periodLabel: string;
  sections: BriefSection[];
}

// ------------------------------------------------------------------ utilidades

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept",
  "oct",
  "nov",
  "dic",
];
const INT = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const DEC = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });

/** "2026-10-05" → "5 oct". */
export function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[m - 1] ?? ""}`.trim();
}

const plural = (n: number, one: string, many: string) => `${INT.format(n)} ${n === 1 ? one : many}`;

function inRange(value: string | null | undefined, from: string, to: string): boolean {
  const ymd = toYmd(value);
  return ymd !== null && ymd >= from && ymd <= to;
}

/** Lista acotada: primeros BRIEF_MAX_ITEMS y "y N más". */
function capped(items: readonly string[]): string[] {
  if (items.length <= BRIEF_MAX_ITEMS) return [...items];
  return [...items.slice(0, BRIEF_MAX_ITEMS), `y ${items.length - BRIEF_MAX_ITEMS} más`];
}

/** Variación porcentual; null si no hay base para comparar. */
export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function vsLabel(current: number, previous: number, hasPrevious: boolean): string {
  if (!hasPrevious) return "sin datos del período anterior";
  const pct = pctChange(current, previous);
  if (pct === null) return "antes 0";
  if (pct === 0) return "igual que el período anterior";
  return `${pct > 0 ? "+" : ""}${pct}% vs. período anterior`;
}

const DELIVERABLE_TYPE: Record<string, string> = {
  post: "post",
  reel: "reel",
  story: "historia",
  design: "diseño",
  meeting: "reunión",
  report: "reporte",
  other: "entrega",
};

const APPROVAL_KIND: Record<string, string> = {
  entregable: "Entrega",
  post_instagram: "Post",
  propuesta: "Propuesta",
};

// ------------------------------------------------------------------ ventanas

export interface BriefWindows {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  nextTo: string;
}

export function briefWindows(today: string): BriefWindows {
  const from = addDaysYmd(today, -(BRIEF_WINDOW_DAYS - 1));
  const prevTo = addDaysYmd(from, -1);
  return {
    from,
    to: today,
    prevFrom: addDaysYmd(prevTo, -(BRIEF_WINDOW_DAYS - 1)),
    prevTo,
    nextTo: addDaysYmd(today, BRIEF_NEXT_DAYS),
  };
}

// ------------------------------------------------------------------ secciones

function estado(input: MeetingBriefInput): string[] {
  const { health } = input;
  if (input.healthError) return ["No se pudo calcular la salud del cliente en este momento."];
  if (!health)
    return ["Sin evaluación de salud (el cliente no está activo, en onboarding ni pausado)."];
  const label = HEALTH_LEVEL_META[health.level].label;
  if (health.level === "sin_datos")
    return [`${label}: hay demasiados registros para evaluarlo con certeza.`];
  if (!health.reasons.length)
    return [`${label}: sin cobros vencidos, aprobaciones trabadas ni alertas abiertas.`];
  return [
    `${label}.`,
    ...health.reasons.map((r) => `${r.severity === "risk" ? "[!] " : ""}${r.label}`),
  ];
}

function hicimos(input: MeetingBriefInput, w: BriefWindows): string[] {
  const done = input.deliverables.filter(
    (d) => d.status === "done" && inRange(d.updated_at, w.from, w.to),
  );
  const published = input.posts.filter((p) => inRange(p.published_at, w.from, w.to)).length;
  const approved = input.posts.filter((p) => inRange(p.approved_at, w.from, w.to)).length;
  const tasks = input.tasks.filter(
    (t) => t.status === "done" && inRange(t.updated_at, w.from, w.to),
  );
  const reports = input.reports.filter((r) => inRange(r.sent_at, w.from, w.to));
  const lines: string[] = [];
  if (done.length) {
    lines.push(`${plural(done.length, "entrega terminada", "entregas terminadas")}:`);
    lines.push(
      ...capped(done.map((d) => `  - ${d.title} (${DELIVERABLE_TYPE[d.type] ?? "entrega"})`)),
    );
  }
  if (published) lines.push(`${plural(published, "publicación", "publicaciones")} en Instagram.`);
  if (approved)
    lines.push(`${plural(approved, "post aprobado", "posts aprobados")} por el cliente.`);
  if (tasks.length) {
    lines.push(`${plural(tasks.length, "tarea completada", "tareas completadas")}:`);
    lines.push(...capped(tasks.map((t) => `  - ${t.title}`)));
  }
  if (reports.length)
    lines.push(
      `${plural(reports.length, "reporte mensual enviado", "reportes mensuales enviados")}.`,
    );
  return lines.length
    ? lines
    : ["Sin entregas, publicaciones ni tareas registradas en los últimos 30 días."];
}

interface PlatformTotals {
  spend: ClpTotals;
  results: number;
  rows: number;
}

function sumMeta(rows: readonly BriefMetaRow[], from: string, to: string): PlatformTotals {
  return rows
    .filter((r) => r.date >= from && r.date <= to)
    .reduce<PlatformTotals>(
      (acc, r) => ({
        spend: addClp(acc.spend, r.currency, Number(r.spend)),
        results: acc.results + (Number(r.messaging_conversations_started) || 0),
        rows: acc.rows + 1,
      }),
      { spend: EMPTY_CLP_TOTALS, results: 0, rows: 0 },
    );
}

function sumGoogle(rows: readonly BriefGoogleRow[], from: string, to: string): PlatformTotals {
  return rows
    .filter((r) => r.date >= from && r.date <= to)
    .reduce<PlatformTotals>(
      (acc, r) => ({
        spend: addClp(acc.spend, "CLP", Number(r.cost_clp)),
        results: acc.results + (Number(r.conversions) || 0),
        rows: acc.rows + 1,
      }),
      { spend: EMPTY_CLP_TOTALS, results: 0, rows: 0 },
    );
}

function platformLines(
  name: string,
  resultLabel: [string, string],
  costLabel: string,
  cur: PlatformTotals,
  prev: PlatformTotals,
): string[] {
  if (!cur.rows) return [`${name}: sin datos en los últimos 30 días.`];
  const hasPrev = prev.rows > 0;
  const fmt = (n: number) => (Number.isInteger(n) ? INT.format(n) : DEC.format(n));
  const lines = [
    `${name}: inversión ${formatClpTotals(cur.spend)} (${vsLabel(cur.spend.clp, prev.spend.clp, hasPrev)}).`,
    `  ${fmt(cur.results)} ${cur.results === 1 ? resultLabel[0] : resultLabel[1]} (${vsLabel(cur.results, prev.results, hasPrev)}).`,
  ];
  if (cur.results > 0 && cur.spend.clp > 0) {
    lines.push(
      `  ${costLabel}: ${formatClpTotals({ ...cur.spend, clp: Math.round(cur.spend.clp / cur.results) })}.`,
    );
  }
  return lines;
}

function resultados(input: MeetingBriefInput, w: BriefWindows): string[] {
  if (input.campaignsTruncated) {
    return [
      "Hay demasiados registros de campañas para resumirlos con certeza: revisa el panel de campañas.",
    ];
  }
  const meta = [
    sumMeta(input.meta, w.from, w.to),
    sumMeta(input.meta, w.prevFrom, w.prevTo),
  ] as const;
  const google = [
    sumGoogle(input.google, w.from, w.to),
    sumGoogle(input.google, w.prevFrom, w.prevTo),
  ] as const;
  const hasMeta = meta[0].rows + meta[1].rows > 0;
  const hasGoogle = google[0].rows + google[1].rows > 0;
  if (!hasMeta && !hasGoogle) return [`${NO_CAMPAIGN_DATA}.`];
  return [
    ...(hasMeta
      ? platformLines(
          "Meta Ads",
          ["conversación iniciada", "conversaciones iniciadas"],
          "Costo por conversación",
          ...meta,
        )
      : []),
    ...(hasGoogle
      ? platformLines(
          "Google Ads",
          ["conversión", "conversiones"],
          "Costo por conversión",
          ...google,
        )
      : []),
  ];
}

function overduePayments(input: MeetingBriefInput): BriefPayment[] {
  return input.payments.filter(
    (p) =>
      p.status === "overdue" ||
      (p.status === "pending" && p.due_date !== null && p.due_date < input.today),
  );
}

function pendientes(input: MeetingBriefInput): string[] {
  const lines: string[] = [];
  if (input.approvals.length) {
    const oldest = input.approvals
      .map((a) => toYmd(a.created_at))
      .filter((d): d is string => d !== null)
      .sort()[0];
    const age = oldest ? `, la más antigua hace ${daysBetween(oldest, input.today)} días` : "";
    lines.push(
      `${plural(input.approvals.length, "pieza espera", "piezas esperan")} su aprobación${age}:`,
    );
    lines.push(
      ...capped(
        input.approvals.map(
          (a) =>
            `  - ${APPROVAL_KIND[a.kind ?? ""] ?? "Pieza"}: ${a.title?.trim() || "sin título"}`,
        ),
      ),
    );
  }
  if (input.intakeSubmitted === false)
    lines.push("Falta que complete el formulario de onboarding (datos, accesos y marca).");
  const overdue = overduePayments(input);
  const upcoming = input.payments.filter((p) => !overdue.includes(p));
  const total = (rows: readonly BriefPayment[]) =>
    formatClpTotals(
      rows.reduce<ClpTotals>(
        (acc, p) => addClp(acc, p.currency, Number(p.amount)),
        EMPTY_CLP_TOTALS,
      ),
    );
  if (overdue.length)
    lines.push(
      `${plural(overdue.length, "cobro vencido", "cobros vencidos")} por ${total(overdue)}.`,
    );
  if (upcoming.length) {
    const next = upcoming
      .map((p) => p.due_date)
      .filter((d): d is string => d !== null)
      .sort()[0];
    lines.push(
      `${plural(upcoming.length, "cobro pendiente", "cobros pendientes")} por ${total(upcoming)}${next ? `, el próximo vence el ${shortDate(next)}` : ""}.`,
    );
  }
  return lines.length ? lines : ["Nada pendiente del lado del cliente."];
}

function proximos(input: MeetingBriefInput, w: BriefWindows): string[] {
  const items: { date: string; text: string }[] = [
    ...input.tasks
      .filter((t) => t.status !== "done" && t.due_date !== null && t.due_date <= w.nextTo)
      .map((t) => ({ date: t.due_date as string, text: t.title })),
    ...input.deliverables
      .filter((d) => d.status !== "done" && d.due_date !== null && d.due_date <= w.nextTo)
      .map((d) => ({
        date: d.due_date as string,
        text: `${d.title} (${DELIVERABLE_TYPE[d.type] ?? "entrega"})`,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const scheduled = input.posts.filter((p) => inRange(p.scheduled_at, w.to, w.nextTo)).length;
  const lines = capped(
    items.map(
      (i) =>
        `${i.date < input.today ? `Atrasada (${shortDate(i.date)})` : shortDate(i.date)}: ${i.text}`,
    ),
  );
  if (scheduled)
    lines.push(
      `${plural(scheduled, "publicación programada", "publicaciones programadas")} en Instagram.`,
    );
  return lines.length ? lines : ["Sin tareas ni entregas con fecha en las próximas 2 semanas."];
}

/** Tres preguntas a partir de los datos, en orden de prioridad (con relleno genérico). */
export function suggestedQuestions(
  input: MeetingBriefInput,
  w: BriefWindows = briefWindows(input.today),
): string[] {
  const meta = sumMeta(input.meta, w.from, w.to);
  const google = sumGoogle(input.google, w.from, w.to);
  const leads = meta.results + google.results;
  const hasCampaigns = !input.campaignsTruncated && meta.rows + google.rows > 0;
  const renewal = input.health?.reasons.some((r) => r.code === "renovacion_cercana") ?? false;
  const candidates: [boolean, string][] = [
    [
      input.approvals.length > 0,
      `¿Podemos revisar juntos ${input.approvals.length === 1 ? "la pieza pendiente" : `las ${input.approvals.length} piezas pendientes`} de aprobación para dejarlas listas?`,
    ],
    [
      input.intakeSubmitted === false,
      "¿Completamos ahora los datos de onboarding que faltan (accesos, marca y objetivos)?",
    ],
    [
      hasCampaigns && leads > 0,
      "De los contactos que llegaron por las campañas este mes, ¿cuántos terminaron en cotización o venta?",
    ],
    [
      hasCampaigns && leads === 0,
      "¿Qué tipo de cliente te gustaría atraer con las campañas en el próximo mes?",
    ],
    [
      overduePayments(input).length > 0,
      "¿Te acomoda que revisemos el cobro pendiente y la fecha de pago que mejor te funciona?",
    ],
    [renewal, "Mirando estos meses, ¿qué te gustaría priorizar en la siguiente etapa?"],
    [
      !hasCampaigns,
      "¿Por qué canal te están llegando hoy los clientes nuevos (Instagram, WhatsApp, recomendación)?",
    ],
    [
      true,
      "¿Hay alguna fecha, promoción o novedad del negocio en las próximas semanas que debamos destacar?",
    ],
    [true, "¿Qué fue lo que más te gustó del contenido de este mes y qué cambiarías?"],
    [true, "¿Recibiste comentarios de tus clientes sobre lo que publicamos?"],
  ];
  return candidates
    .filter(([ok]) => ok)
    .map(([, q]) => q)
    .slice(0, 3);
}

export function buildMeetingBrief(input: MeetingBriefInput): MeetingBrief {
  const w = briefWindows(input.today);
  return {
    title: `Resumen para reunión: ${input.clientName.trim() || "Cliente"}`,
    periodLabel: `Últimos 30 días (${shortDate(w.from)} al ${shortDate(w.to)}); comparado con ${shortDate(w.prevFrom)} al ${shortDate(w.prevTo)}.`,
    sections: [
      { key: "estado", title: "1. Estado", lines: estado(input) },
      { key: "hicimos", title: "2. Qué hicimos", lines: hicimos(input, w) },
      { key: "resultados", title: "3. Resultados", lines: resultados(input, w) },
      { key: "pendientes", title: "4. Pendientes del cliente", lines: pendientes(input) },
      { key: "proximos", title: "5. Próximos pasos (2 semanas)", lines: proximos(input, w) },
      {
        key: "preguntas",
        title: "6. Preguntas sugeridas",
        lines: suggestedQuestions(input, w).map((q, i) => `${i + 1}. ${q}`),
      },
    ],
  };
}

// ------------------------------------------------------------------ formatos

/** Texto plano para pegar en notas, WhatsApp o correo. */
export function briefToText(brief: MeetingBrief): string {
  const bullet = (line: string) => (/^(\s|\d+\.)/.test(line) ? line : `• ${line}`);
  const body = brief.sections.map((s) =>
    [s.title.toUpperCase(), ...s.lines.map(bullet)].join("\n"),
  );
  return [brief.title, brief.periodLabel, "", body.join("\n\n")].join("\n");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PRINT_CSS = `
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111;margin:32px;line-height:1.45}
  h1{font-size:20px;margin:0 0 4px}
  .period{color:#555;font-size:12px;margin:0 0 20px}
  h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
  ul{margin:0;padding-left:18px}
  li{font-size:13px;margin:2px 0}
  li.sub{list-style:circle;margin-left:16px}
  section{break-inside:avoid}
  @page{margin:16mm}
`;

/** Documento HTML autónomo para imprimir (todo el texto se escapa). */
export function briefToPrintHtml(brief: MeetingBrief): string {
  const item = (line: string) =>
    line.startsWith("  ")
      ? `<li class="sub">${escapeHtml(line.trim().replace(/^- /, ""))}</li>`
      : `<li>${escapeHtml(line)}</li>`;
  const sections = brief.sections
    .map(
      (s) =>
        `<section><h2>${escapeHtml(s.title)}</h2><ul>${s.lines.map(item).join("")}</ul></section>`,
    )
    .join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(brief.title)}</title><style>${PRINT_CSS}</style></head><body><h1>${escapeHtml(brief.title)}</h1><p class="period">${escapeHtml(brief.periodLabel)}</p>${sections}</body></html>`;
}
