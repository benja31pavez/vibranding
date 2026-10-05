/**
 * "Resumen para reunión": arma, a partir de filas ya leídas de la BD, un brief
 * listo para leer antes de una llamada con el cliente (últimos 30 días).
 *
 * - Sin E/S ni React: se prueba con datos falsos y `today` fijo (scripts/check-briefing.mjs).
 * - Fechas de calendario en America/Santiago (las consultas traen margen y aquí
 *   se filtra exacto).
 * - Nunca inventa cifras: sin filas de campañas dice "Sin datos de campañas";
 *   si los datos vinieron truncados no muestra totales; solo compara con el
 *   período anterior si está cubierto (BRIEF_MIN_COVERAGE).
 * - Solo CLP: montos en otra moneda se dejan fuera con aviso y, en ese caso,
 *   no se calculan costos por resultado ni variaciones de inversión.
 */
import { addDaysYmd } from "@/lib/dates/chile";
import { HEALTH_LEVEL_META, daysBetween, toYmd } from "@/lib/health/score";
import type { HealthLevel, HealthReason } from "@/lib/health/types";
import { EMPTY_CLP_TOTALS, addClp, formatClpTotals, type ClpTotals } from "@/lib/pricing/plans";

export const BRIEF_WINDOW_DAYS = 30;
export const BRIEF_NEXT_DAYS = 14;
/** Máximo de ítems listados por bloque (el resto se resume como "y N más"). */
export const BRIEF_MAX_ITEMS = 5;
/** Fracción mínima de días con datos en el período anterior para comparar. */
export const BRIEF_MIN_COVERAGE = 0.8;
/** Tipos de la cola de aprobación que dependen del cliente (igual que Salud). */
export const BRIEF_APPROVAL_KINDS: readonly string[] = ["entregable", "post_instagram"];
export const NO_CAMPAIGN_DATA = "Sin datos de campañas";
export const PARTIAL_LIST = "(lista parcial: hay más registros de los que se muestran)";

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
}

/** Fila de ad_insights_daily (nivel anuncio: varias por día, se suman). */
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

export type BriefListKey =
  "deliverables" | "posts" | "tasks" | "reports" | "approvals" | "payments";

export interface MeetingBriefInput {
  clientName: string;
  /** Hoy en Chile ("YYYY-MM-DD"). */
  today: string;
  /** null = el cliente no se puntúa (prospecto/terminado). */
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
  /** Plataformas cuya consulta llegó a su tope: no se muestran sus totales. */
  campaignsPartial: { meta: boolean; google: boolean };
  /** Listas que llegaron a su límite (se marcan como parciales). */
  partialLists: readonly BriefListKey[];
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

/** 0 → "de hoy", 1 → "de ayer", n → "hace n días". */
export function agoLabel(days: number): string {
  if (days <= 0) return "de hoy";
  if (days === 1) return "de ayer";
  return `hace ${INT.format(days)} días`;
}

const plural = (n: number, one: string, many: string) => `${INT.format(n)} ${n === 1 ? one : many}`;
const fmtNumber = (n: number) => (Number.isInteger(n) ? INT.format(n) : DEC.format(n));

function inRange(value: string | null | undefined, from: string, to: string): boolean {
  const ymd = toYmd(value);
  return ymd !== null && ymd >= from && ymd <= to;
}

/** Lista acotada: primeros BRIEF_MAX_ITEMS y "y N más". */
function capped(items: readonly string[]): string[] {
  if (items.length <= BRIEF_MAX_ITEMS) return [...items];
  return [...items.slice(0, BRIEF_MAX_ITEMS), `  y ${items.length - BRIEF_MAX_ITEMS} más`];
}

function withPartial(
  lines: string[],
  input: MeetingBriefInput,
  keys: readonly BriefListKey[],
): string[] {
  return keys.some((k) => input.partialLists.includes(k)) ? [...lines, PARTIAL_LIST] : lines;
}

/** Variación porcentual; null si no hay base para comparar. */
export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function pctLabel(current: number, previous: number): string {
  const pct = pctChange(current, previous);
  if (pct === null) return "el período anterior fue 0";
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

const APPROVAL_KIND: Record<string, string> = { entregable: "Entrega", post_instagram: "Post" };

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

export function briefPeriodLabel(today: string): string {
  const w = briefWindows(today);
  return `Últimos 30 días (${shortDate(w.from)} al ${shortDate(w.to)}); comparado con ${shortDate(w.prevFrom)} al ${shortDate(w.prevTo)}.`;
}

// ------------------------------------------------------------------ estado y trabajo hecho

function estado(input: MeetingBriefInput): string[] {
  const { health } = input;
  if (input.healthError) return ["No se pudo calcular la salud del cliente en este momento."];
  if (!health) {
    return ["Sin evaluación de salud (el cliente no está activo, en onboarding ni pausado)."];
  }
  const label = HEALTH_LEVEL_META[health.level].label;
  if (health.level === "sin_datos") {
    return [`${label}: hay demasiados registros para evaluarlo con certeza.`];
  }
  if (!health.reasons.length) {
    return [`${label}: sin cobros vencidos, aprobaciones trabadas ni alertas abiertas.`];
  }
  return [
    `${label}.`,
    ...health.reasons.map((r) => `${r.severity === "risk" ? "[!] " : ""}${r.label}`),
  ];
}

const doneLabel = (n: number, one: string, many: string) =>
  `${plural(n, one, many)} como terminada${n === 1 ? "" : "s"} en el período:`;

function hicimos(input: MeetingBriefInput, w: BriefWindows): string[] {
  // No hay columna de fecha de término: se usa la última actualización de lo marcado como hecho.
  const done = input.deliverables.filter(
    (d) => d.status === "done" && inRange(d.updated_at, w.from, w.to),
  );
  const published = input.posts.filter((p) => inRange(p.published_at, w.from, w.to)).length;
  const approved = input.posts.filter((p) => inRange(p.approved_at, w.from, w.to)).length;
  const tasks = input.tasks.filter(
    (t) => t.status === "done" && inRange(t.updated_at, w.from, w.to),
  );
  const reports = input.reports.filter((r) => inRange(r.sent_at, w.from, w.to)).length;
  const lines: string[] = [];
  if (done.length) {
    lines.push(doneLabel(done.length, "entrega marcada", "entregas marcadas"));
    lines.push(
      ...capped(done.map((d) => `  - ${d.title} (${DELIVERABLE_TYPE[d.type] ?? "entrega"})`)),
    );
  }
  if (published) lines.push(`${plural(published, "publicación", "publicaciones")} en Instagram.`);
  if (approved) {
    lines.push(`${plural(approved, "post aprobado", "posts aprobados")} por el cliente.`);
  }
  if (tasks.length) {
    lines.push(doneLabel(tasks.length, "tarea marcada", "tareas marcadas"));
    lines.push(...capped(tasks.map((t) => `  - ${t.title}`)));
  }
  if (reports) {
    lines.push(`${plural(reports, "reporte mensual enviado", "reportes mensuales enviados")}.`);
  }
  const out = lines.length
    ? lines
    : ["Sin entregas, publicaciones ni tareas registradas en los últimos 30 días."];
  return withPartial(out, input, ["deliverables", "posts", "tasks", "reports"]);
}

// ------------------------------------------------------------------ campañas

export interface PlatformTotals {
  spend: ClpTotals;
  results: number;
  /** Días distintos con al menos una fila. */
  days: number;
}

interface CampaignRow {
  date: string;
  spend: number;
  currency: string | null;
  results: number;
}

const metaRows = (rows: readonly BriefMetaRow[]): CampaignRow[] =>
  rows.map((r) => ({
    date: r.date,
    spend: Number(r.spend),
    currency: r.currency,
    results: Number(r.messaging_conversations_started) || 0,
  }));

const googleRows = (rows: readonly BriefGoogleRow[]): CampaignRow[] =>
  rows.map((r) => ({
    date: r.date,
    spend: Number(r.cost_clp),
    currency: "CLP",
    results: Number(r.conversions) || 0,
  }));

function sumWindow(rows: readonly CampaignRow[], from: string, to: string): PlatformTotals {
  const inWindow = rows.filter((r) => r.date >= from && r.date <= to);
  return {
    spend: inWindow.reduce<ClpTotals>(
      (acc, r) => addClp(acc, r.currency, r.spend),
      EMPTY_CLP_TOTALS,
    ),
    results: inWindow.reduce((acc, r) => acc + r.results, 0),
    days: new Set(inWindow.map((r) => r.date)).size,
  };
}

interface PlatformWindows {
  cur: PlatformTotals;
  prev: PlatformTotals;
  any: boolean;
}

interface PlatformCopy {
  name: string;
  resultLabel: readonly [string, string];
  costLabel: string;
}

const META_COPY: PlatformCopy = {
  name: "Meta Ads",
  resultLabel: ["conversación iniciada", "conversaciones iniciadas"],
  costLabel: "Costo por conversación",
};
const GOOGLE_COPY: PlatformCopy = {
  name: "Google Ads",
  resultLabel: ["conversión", "conversiones"],
  costLabel: "Costo por conversión",
};
const NO_FULL_PREVIOUS = "sin datos completos del período anterior";
const MIN_PREVIOUS_DAYS = Math.ceil(BRIEF_WINDOW_DAYS * BRIEF_MIN_COVERAGE);

function platformLines(copy: PlatformCopy, { cur, prev }: PlatformWindows): string[] {
  if (!cur.days) return [`${copy.name}: sin datos en los últimos 30 días.`];
  const comparable = prev.days >= MIN_PREVIOUS_DAYS;
  const mixedCurrency =
    cur.spend.excludedCurrencies.length > 0 || prev.spend.excludedCurrencies.length > 0;
  const coverage =
    cur.days < BRIEF_WINDOW_DAYS ? ` (datos de ${cur.days} de ${BRIEF_WINDOW_DAYS} días)` : "";
  const spendVs = !comparable
    ? NO_FULL_PREVIOUS
    : mixedCurrency
      ? null
      : pctLabel(cur.spend.clp, prev.spend.clp);
  const resultsVs = comparable ? pctLabel(cur.results, prev.results) : NO_FULL_PREVIOUS;
  const resultWord = cur.results === 1 ? copy.resultLabel[0] : copy.resultLabel[1];
  const lines = [
    `${copy.name}${coverage}: inversión ${formatClpTotals(cur.spend)}${spendVs ? ` (${spendVs})` : ""}.`,
    `  ${fmtNumber(cur.results)} ${resultWord} (${resultsVs}).`,
  ];
  if (!mixedCurrency && cur.results > 0 && cur.spend.clp > 0) {
    lines.push(
      `  ${copy.costLabel}: ${formatClpTotals({ ...cur.spend, clp: Math.round(cur.spend.clp / cur.results) })}.`,
    );
  }
  return lines;
}

function platforms(input: MeetingBriefInput, w: BriefWindows) {
  const build = (rows: CampaignRow[]): PlatformWindows => ({
    cur: sumWindow(rows, w.from, w.to),
    prev: sumWindow(rows, w.prevFrom, w.prevTo),
    any: rows.some((r) => r.date >= w.prevFrom && r.date <= w.to),
  });
  return { meta: build(metaRows(input.meta)), google: build(googleRows(input.google)) };
}

const partialCampaigns = (name: string) =>
  `${name}: hay demasiados registros para resumirlos con certeza; revisa el panel de campañas.`;

function platformSection(copy: PlatformCopy, data: PlatformWindows, partial: boolean): string[] {
  if (partial) return [partialCampaigns(copy.name)];
  return data.any ? platformLines(copy, data) : [];
}

function resultados(input: MeetingBriefInput, w: BriefWindows): string[] {
  const { meta, google } = platforms(input, w);
  const lines = [
    ...platformSection(META_COPY, meta, input.campaignsPartial.meta),
    ...platformSection(GOOGLE_COPY, google, input.campaignsPartial.google),
  ];
  return lines.length ? lines : [`${NO_CAMPAIGN_DATA}.`];
}

// ------------------------------------------------------------------ pendientes y próximos

function clientApprovals(input: MeetingBriefInput): BriefApproval[] {
  return input.approvals.filter((a) => BRIEF_APPROVAL_KINDS.includes(a.kind ?? ""));
}

function overduePayments(input: MeetingBriefInput): BriefPayment[] {
  return input.payments.filter(
    (p) =>
      p.status === "overdue" ||
      (p.status === "pending" && p.due_date !== null && p.due_date < input.today),
  );
}

const paymentsTotal = (rows: readonly BriefPayment[]) =>
  formatClpTotals(
    rows.reduce<ClpTotals>((acc, p) => addClp(acc, p.currency, Number(p.amount)), EMPTY_CLP_TOTALS),
  );

const earliest = (dates: readonly (string | null)[]): string | undefined =>
  dates.filter((d): d is string => d !== null).sort()[0];

function approvalLines(input: MeetingBriefInput): string[] {
  const approvals = clientApprovals(input);
  if (!approvals.length) return [];
  const oldest = earliest(approvals.map((a) => toYmd(a.created_at)));
  const age = oldest ? `, la más antigua ${agoLabel(daysBetween(oldest, input.today))}` : "";
  return [
    `${plural(approvals.length, "pieza espera", "piezas esperan")} su aprobación${age}:`,
    ...capped(
      approvals.map(
        (a) => `  - ${APPROVAL_KIND[a.kind ?? ""] ?? "Pieza"}: ${a.title?.trim() || "sin título"}`,
      ),
    ),
  ];
}

function paymentLines(input: MeetingBriefInput): string[] {
  const overdue = overduePayments(input);
  const upcoming = input.payments.filter((p) => p.status === "pending" && !overdue.includes(p));
  const lines: string[] = [];
  if (overdue.length) {
    lines.push(
      `${plural(overdue.length, "cobro vencido", "cobros vencidos")} por ${paymentsTotal(overdue)}.`,
    );
  }
  if (upcoming.length) {
    const next = earliest(upcoming.map((p) => p.due_date));
    const when = next ? `, el próximo vence el ${shortDate(next)}` : "";
    lines.push(
      `${plural(upcoming.length, "cobro pendiente", "cobros pendientes")} por ${paymentsTotal(upcoming)}${when}.`,
    );
  }
  return lines;
}

function pendientes(input: MeetingBriefInput): string[] {
  const lines = [
    ...approvalLines(input),
    ...(input.intakeSubmitted === false
      ? ["Falta que complete el formulario de onboarding (datos, accesos y marca)."]
      : []),
    ...paymentLines(input),
  ];
  const out = lines.length ? lines : ["Nada pendiente del lado del cliente."];
  return withPartial(out, input, ["approvals", "payments"]);
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
  const when = (date: string) =>
    date < input.today ? `Atrasada (${shortDate(date)})` : shortDate(date);
  const lines = capped(items.map((i) => `${when(i.date)}: ${i.text}`));
  if (scheduled) {
    lines.push(
      `${plural(scheduled, "publicación programada", "publicaciones programadas")} en Instagram.`,
    );
  }
  const out = lines.length
    ? lines
    : ["Sin tareas ni entregas con fecha en las próximas 2 semanas."];
  return withPartial(out, input, ["tasks", "deliverables", "posts"]);
}

// ------------------------------------------------------------------ preguntas

/** Tres preguntas a partir de los datos, en orden de prioridad (con relleno genérico). */
export function suggestedQuestions(
  input: MeetingBriefInput,
  w: BriefWindows = briefWindows(input.today),
): string[] {
  const { meta, google } = platforms(input, w);
  // Cada plataforma por separado: nunca se suman resultados de Meta y Google.
  const metaOk = !input.campaignsPartial.meta && meta.cur.days > 0;
  const googleOk = !input.campaignsPartial.google && google.cur.days > 0;
  const approvals = clientApprovals(input).length;
  const renewal = input.health?.reasons.some((r) => r.code === "renovacion_cercana") ?? false;
  const pieces = approvals === 1 ? "la pieza pendiente" : `las ${approvals} piezas pendientes`;
  const candidates: [boolean, string][] = [
    [approvals > 0, `¿Podemos revisar juntos ${pieces} de aprobación para dejarlas listas?`],
    [
      input.intakeSubmitted === false,
      "¿Completamos ahora los datos de onboarding que faltan (accesos, marca y objetivos)?",
    ],
    [
      metaOk && meta.cur.results > 0,
      "De las conversaciones que llegaron por Meta Ads este mes, ¿cuántas terminaron en cotización o venta?",
    ],
    [
      googleOk && google.cur.results > 0,
      "De las conversiones que registró Google Ads este mes, ¿cuántas fueron clientes reales?",
    ],
    [
      metaOk && meta.cur.results === 0,
      "¿Qué tipo de cliente te gustaría atraer con Meta Ads el próximo mes?",
    ],
    [
      googleOk && google.cur.results === 0,
      "¿Qué búsquedas o servicios te gustaría priorizar en Google Ads el próximo mes?",
    ],
    [
      overduePayments(input).length > 0,
      "¿Te acomoda que revisemos el cobro pendiente y la fecha de pago que mejor te funciona?",
    ],
    [renewal, "Mirando estos meses, ¿qué te gustaría priorizar en la siguiente etapa?"],
    [
      !metaOk && !googleOk,
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
    periodLabel: briefPeriodLabel(input.today),
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
  const bullet = (line: string) => (/^(\s|\d+\.|\()/.test(line) ? line : `• ${line}`);
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

/** Script fijo (sin datos del cliente) que abre el diálogo de impresión al cargar. */
const AUTO_PRINT = "<script>window.addEventListener('load',function(){window.print();});</script>";

/** Documento HTML autónomo para imprimir (todo el texto se escapa). */
export function briefToPrintHtml(
  brief: MeetingBrief,
  options: { autoPrint?: boolean } = {},
): string {
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
  const script = options.autoPrint ? AUTO_PRINT : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(brief.title)}</title><style>${PRINT_CSS}</style></head><body><h1>${escapeHtml(brief.title)}</h1><p class="period">${escapeHtml(brief.periodLabel)}</p>${sections}${script}</body></html>`;
}
