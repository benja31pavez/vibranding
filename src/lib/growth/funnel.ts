/**
 * Embudo comercial (cálculo puro, sin red). Lo usa la pestaña "Crecimiento" de
 * /reports y lo revisa scripts/check-growth.mjs.
 *
 * No hay historial de cambios de estado de prospectos, así que cada etapa se
 * deduce del estado actual + las propuestas ligadas al prospecto:
 *  - Nuevos: prospectos creados en el período (sin "baja"; "frío" sí cuenta).
 *  - Contactados: estado contactado/respondió/demo/propuesta/ganado, con último
 *    contacto o con propuesta. Un "frío" o "perdido" sin ninguna de esas señales
 *    no cuenta como contactado (pudo descartarse sin contacto).
 *  - Propuesta enviada: propuesta enviada/vista/aceptada/rechazada/expirada,
 *    estado "propuesta" o ganado.
 *  - Ganados: estado "ganado", propuesta aceptada o convertido en cliente.
 * Cada etapa incluye a las siguientes, así las tasas nunca superan 100 %.
 */

export interface FunnelProspect {
  id: string;
  estado: string;
  fuente: string;
  created_at: string;
  ultimo_contacto: string | null;
  client_id: string | null;
}

export interface FunnelProposal {
  prospect_id: string | null;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
}

export type FunnelStageKey = "nuevos" | "contactados" | "propuesta" | "ganados";

export interface FunnelStage {
  key: FunnelStageKey;
  label: string;
  count: number;
  /** % respecto de la etapa anterior (null en la primera o si la anterior es 0). */
  conversionFromPrev: number | null;
}

export interface FunnelSummary {
  stages: FunnelStage[];
  /** % de nuevos que terminaron ganados (null si no hubo nuevos). */
  overallConversion: number | null;
  /** Mediana de días entre la creación del prospecto y la aceptación de su propuesta. */
  medianDaysToClose: number | null;
  /** Ganados con fecha de aceptación (base de la mediana). */
  closedWithDate: number;
}

export interface SourceRow {
  source: string;
  nuevos: number;
  propuestas: number;
  ganados: number;
  /** % ganados / nuevos. */
  winRate: number | null;
}

export const EXCLUDED_STATE = "baja";
/** Estados de proposals.status (CHECK proposals_status_chk) posteriores al envío. */
const SENT_STATUSES = new Set(["enviada", "vista", "aceptada", "rechazada", "expirada"]);
const PROPOSAL_STATES = new Set(["propuesta", "ganado"]);
const CONTACTED_STATES = new Set(["contactado", "respondio", "demo", "propuesta", "ganado"]);
const DAY_MS = 86_400_000;

const STAGE_LABELS: Readonly<Record<FunnelStageKey, string>> = {
  nuevos: "Prospectos nuevos",
  contactados: "Contactados",
  propuesta: "Propuesta enviada",
  ganados: "Ganados",
};

/** Origen legible a partir del texto libre `prospects.fuente`. */
const SOURCE_RULES: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /diagn[oó]stico/i, label: "Web · diagnóstico" },
  { re: /cazamarca/i, label: "Cazamarcas" },
  { re: /oficina de agentes/i, label: "Oficina de agentes" },
  { re: /referid|recomend/i, label: "Referido" },
  { re: /instagram/i, label: "Instagram" },
  { re: /google|maps/i, label: "Google" },
  { re: /linkedin/i, label: "LinkedIn" },
  { re: /facebook|\bmeta\b/i, label: "Facebook" },
  { re: /whatsapp/i, label: "WhatsApp" },
  { re: /web|sitio|landing/i, label: "Web" },
];
export const OTHER_SOURCE = "Otro";

export function classifySource(fuente: string | null | undefined): string {
  const text = (fuente ?? "").trim();
  if (!text) return OTHER_SOURCE;
  return SOURCE_RULES.find((rule) => rule.re.test(text))?.label ?? OTHER_SOURCE;
}

/** Porcentaje 0-100 con un decimal; null si el denominador es 0. */
export function conversionPct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface ProspectProgress {
  contacted: boolean;
  proposalSent: boolean;
  won: boolean;
  closeDays: number | null;
}

function groupProposals(proposals: readonly FunnelProposal[]): Map<string, FunnelProposal[]> {
  const byProspect = new Map<string, FunnelProposal[]>();
  for (const p of proposals) {
    if (!p.prospect_id) continue;
    byProspect.set(p.prospect_id, [...(byProspect.get(p.prospect_id) ?? []), p]);
  }
  return byProspect;
}

function firstAcceptedAt(proposals: readonly FunnelProposal[]): number | null {
  const times = proposals
    .filter((p) => p.status === "aceptada" && p.accepted_at)
    .map((p) => Date.parse(p.accepted_at as string))
    .filter(Number.isFinite);
  return times.length ? Math.min(...times) : null;
}

function progressOf(
  prospect: FunnelProspect,
  proposals: readonly FunnelProposal[],
): ProspectProgress {
  const accepted = proposals.some((p) => p.status === "aceptada");
  const sent = proposals.some((p) => Boolean(p.sent_at) || SENT_STATUSES.has(p.status));
  const won = prospect.estado === "ganado" || accepted || Boolean(prospect.client_id);
  const proposalSent = won || sent || PROPOSAL_STATES.has(prospect.estado);
  const contacted =
    proposalSent || CONTACTED_STATES.has(prospect.estado) || Boolean(prospect.ultimo_contacto);
  const acceptedAt = firstAcceptedAt(proposals);
  const createdAt = Date.parse(prospect.created_at);
  const closeDays =
    won && acceptedAt !== null && Number.isFinite(createdAt)
      ? Math.max(0, Math.round((acceptedAt - createdAt) / DAY_MS))
      : null;
  return { contacted, proposalSent, won, closeDays };
}

function activeProspects(prospects: readonly FunnelProspect[]): FunnelProspect[] {
  return prospects.filter((p) => p.estado !== EXCLUDED_STATE);
}

function buildStages(counts: Readonly<Record<FunnelStageKey, number>>): FunnelStage[] {
  const order: FunnelStageKey[] = ["nuevos", "contactados", "propuesta", "ganados"];
  return order.map((key, i) => ({
    key,
    label: STAGE_LABELS[key],
    count: counts[key],
    conversionFromPrev: i === 0 ? null : conversionPct(counts[key], counts[order[i - 1]]),
  }));
}

export function computeFunnel(
  prospects: readonly FunnelProspect[],
  proposals: readonly FunnelProposal[],
): FunnelSummary {
  const byProspect = groupProposals(proposals);
  const progress = activeProspects(prospects).map((p) => progressOf(p, byProspect.get(p.id) ?? []));
  const counts = {
    nuevos: progress.length,
    contactados: progress.filter((p) => p.contacted).length,
    propuesta: progress.filter((p) => p.proposalSent).length,
    ganados: progress.filter((p) => p.won).length,
  };
  const closeDays = progress.flatMap((p) => (p.closeDays === null ? [] : [p.closeDays]));
  return {
    stages: buildStages(counts),
    overallConversion: conversionPct(counts.ganados, counts.nuevos),
    medianDaysToClose: median(closeDays),
    closedWithDate: closeDays.length,
  };
}

/** Fuentes ordenadas por ganados, luego tasa de cierre y luego volumen. */
export function computeSources(
  prospects: readonly FunnelProspect[],
  proposals: readonly FunnelProposal[],
): SourceRow[] {
  const byProspect = groupProposals(proposals);
  const rows = new Map<string, { nuevos: number; propuestas: number; ganados: number }>();
  for (const prospect of activeProspects(prospects)) {
    const source = classifySource(prospect.fuente);
    const progress = progressOf(prospect, byProspect.get(prospect.id) ?? []);
    const prev = rows.get(source) ?? { nuevos: 0, propuestas: 0, ganados: 0 };
    rows.set(source, {
      nuevos: prev.nuevos + 1,
      propuestas: prev.propuestas + (progress.proposalSent ? 1 : 0),
      ganados: prev.ganados + (progress.won ? 1 : 0),
    });
  }
  return [...rows.entries()]
    .map(([source, r]) => ({ source, ...r, winRate: conversionPct(r.ganados, r.nuevos) }))
    .sort(
      (a, b) => b.ganados - a.ganados || (b.winRate ?? 0) - (a.winRate ?? 0) || b.nuevos - a.nuevos,
    );
}
