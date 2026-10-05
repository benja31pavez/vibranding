/**
 * Agregación pura de landing_events del sitio para la página Estadísticas:
 * visitantes únicos por día, embudo, fuentes, tendencia y dispositivos.
 *
 * Reglas de precisión:
 * - Se descartan bots por user-agent (también en datos históricos).
 * - Visitante = visitor_hash (por día) → session_id → evento suelto (filas
 *   antiguas sin sesión, contadas 1 a 1 y reportadas aparte).
 * - "Visitas únicas" = suma de visitantes únicos de cada día de Santiago.
 * - La fuente de un visitante-día es la de su primer evento (primer contacto).
 */
import { isBotUserAgent } from "./bots";
import { DIRECT_SOURCE, deviceType, sourceLabel, type AttributionFields } from "./attribution";
import { santiagoDayKey, santiagoDayRange } from "./time";

/** Fila de landing_events; las columnas nuevas pueden faltar si la migración no está aplicada. */
export interface RawSiteEvent extends AttributionFields {
  id: string;
  event_name: string;
  created_at: string;
  user_agent?: string | null;
  session_id?: string | null;
  visitor_hash?: string | null;
  device_type?: string | null;
  cta?: string | null;
}

export const CTA_EVENTS: ReadonlySet<string> = new Set(["whatsapp_click", "contact_click"]);

export interface FunnelStage {
  key: "visits" | "cta" | "submits" | "prospects";
  label: string;
  value: number;
  /** % respecto de las visitas únicas; null si no hay visitas. */
  rateFromVisits: number | null;
}

export interface SourceRow {
  source: string;
  visits: number;
  ctaVisitors: number;
  submits: number;
  /** Diagnósticos / visitas, en %; null si no hay visitas. */
  conversion: number | null;
}

export interface SiteStats {
  days: string[];
  funnel: FunnelStage[];
  sources: SourceRow[];
  trend: Array<{ day: string; visits: number }>;
  devices: Record<"mobile" | "tablet" | "desktop", number>;
  ctaBreakdown: { whatsapp: number; diagnostico: number; plan: number };
  sample: {
    /** Eventos válidos dentro del rango (sin bots). */
    events: number;
    botsExcluded: number;
    /** Eventos sin sesión (anteriores a la medición precisa). */
    legacyEvents: number;
    sessions: number;
  };
}

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function visitorId(row: RawSiteEvent): { id: string; legacy: boolean } {
  if (row.visitor_hash) return { id: `v:${row.visitor_hash}`, legacy: false };
  if (row.session_id) return { id: `s:${row.session_id}`, legacy: false };
  return { id: `e:${row.id}`, legacy: true };
}

function ctaKind(row: RawSiteEvent): keyof SiteStats["ctaBreakdown"] {
  if (row.cta?.startsWith("plan")) return "plan";
  return row.event_name === "whatsapp_click" ? "whatsapp" : "diagnostico";
}

interface Bucket {
  visits: Set<string>;
  cta: Set<string>;
  submits: Set<string>;
}

const newBucket = (): Bucket => ({ visits: new Set(), cta: new Set(), submits: new Set() });

/** Estado local de una pasada de agregación (no sale de aggregateSiteStats). */
interface Acc {
  total: Bucket;
  bySource: Map<string, Bucket>;
  sourceOf: Map<string, string>;
  perDay: Map<string, Set<string>>;
  deviceOf: Map<string, string>;
  sessions: Set<string>;
  ctaSeen: Set<string>;
  ctaBreakdown: SiteStats["ctaBreakdown"];
  counters: { events: number; botsExcluded: number; legacyEvents: number };
}

function newAcc(days: readonly string[]): Acc {
  return {
    total: newBucket(),
    bySource: new Map(),
    sourceOf: new Map(),
    perDay: new Map(days.map((d) => [d, new Set<string>()])),
    deviceOf: new Map(),
    sessions: new Set(),
    ctaSeen: new Set(),
    ctaBreakdown: { whatsapp: 0, diagnostico: 0, plan: 0 },
    counters: { events: 0, botsExcluded: 0, legacyEvents: 0 },
  };
}

function bucketFor(acc: Acc, key: string, row: RawSiteEvent): Bucket {
  if (!acc.sourceOf.has(key)) acc.sourceOf.set(key, sourceLabel(row));
  const source = acc.sourceOf.get(key) ?? DIRECT_SOURCE;
  const bucket = acc.bySource.get(source) ?? newBucket();
  acc.bySource.set(source, bucket);
  return bucket;
}

function addEvent(acc: Acc, row: RawSiteEvent, day: string): void {
  acc.counters.events += 1;
  const visitor = visitorId(row);
  if (visitor.legacy) acc.counters.legacyEvents += 1;
  if (row.session_id) acc.sessions.add(row.session_id);
  const key = `${day}|${visitor.id}`;
  const bucket = bucketFor(acc, key, row);

  if (row.event_name === "page_view") {
    acc.total.visits.add(key);
    bucket.visits.add(key);
    acc.perDay.get(day)?.add(key);
    if (!acc.deviceOf.has(key))
      acc.deviceOf.set(key, row.device_type || deviceType(row.user_agent));
  } else if (CTA_EVENTS.has(row.event_name)) {
    acc.total.cta.add(key);
    bucket.cta.add(key);
    const kind = ctaKind(row);
    if (!acc.ctaSeen.has(`${key}|${kind}`)) {
      acc.ctaSeen.add(`${key}|${kind}`);
      acc.ctaBreakdown[kind] += 1;
    }
  } else if (row.event_name === "contact_submit") {
    const submitKey = row.session_id ? `s:${row.session_id}` : `e:${row.id}`;
    acc.total.submits.add(submitKey);
    bucket.submits.add(submitKey);
  }
}

function buildFunnel(total: Bucket, prospects: number): FunnelStage[] {
  const visits = total.visits.size;
  const stage = (key: FunnelStage["key"], label: string, value: number): FunnelStage => ({
    key,
    label,
    value,
    rateFromVisits: pct(value, visits),
  });
  return [
    stage("visits", "Visitas únicas", visits),
    stage("cta", "Clics a CTA", total.cta.size),
    stage("submits", "Diagnósticos enviados", total.submits.size),
    stage("prospects", "Prospectos creados", prospects),
  ];
}

function buildSources(bySource: Map<string, Bucket>): SourceRow[] {
  return [...bySource.entries()]
    .map(([source, b]) => ({
      source,
      visits: b.visits.size,
      ctaVisitors: b.cta.size,
      submits: b.submits.size,
      conversion: pct(b.submits.size, b.visits.size),
    }))
    .filter((s) => s.visits + s.ctaVisitors + s.submits > 0)
    .sort(
      (a, b) => b.visits - a.visits || b.submits - a.submits || a.source.localeCompare(b.source),
    );
}

function countDevices(deviceOf: Map<string, string>): SiteStats["devices"] {
  const devices = { mobile: 0, tablet: 0, desktop: 0 };
  for (const d of deviceOf.values()) {
    if (d === "mobile" || d === "tablet" || d === "desktop") devices[d] += 1;
  }
  return devices;
}

export function aggregateSiteStats(
  rows: readonly RawSiteEvent[],
  opts: { days: number; now?: Date; prospectDates: readonly string[] },
): SiteStats {
  const days = santiagoDayRange(opts.days, opts.now);
  const inRange = new Set(days);
  const acc = newAcc(days);
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));

  for (const row of sorted) {
    const day = santiagoDayKey(row.created_at);
    if (!inRange.has(day)) continue;
    if (isBotUserAgent(row.user_agent)) acc.counters.botsExcluded += 1;
    else addEvent(acc, row, day);
  }

  const prospects = opts.prospectDates.filter((d) => inRange.has(santiagoDayKey(d))).length;
  return {
    days,
    funnel: buildFunnel(acc.total, prospects),
    sources: buildSources(acc.bySource),
    trend: days.map((day) => ({ day, visits: acc.perDay.get(day)?.size ?? 0 })),
    devices: countDevices(acc.deviceOf),
    ctaBreakdown: acc.ctaBreakdown,
    sample: { ...acc.counters, sessions: acc.sessions.size },
  };
}

/** Página `page` (desde 0) de `items`, con el total de páginas (mínimo 1). */
export function paginate<T>(items: readonly T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(0, page), pages - 1);
  return { items: items.slice(current * size, current * size + size), page: current, pages };
}
