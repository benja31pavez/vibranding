/**
 * Reporte mensual por cliente: arma el snapshot del mes (hora de Chile), lo
 * compara con el mes anterior y lo guarda en monthly_reports (un registro por
 * client_id + period). El token público lo genera siempre la BD.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  collectBookings,
  collectDeliverables,
  collectGoogleAds,
  collectInstagram,
  collectLanding,
  collectLeads,
  collectMetaAds,
  type RawAds,
  type RawInstagram,
  type RawLanding,
  type RawLeads,
} from "./collectors.server";
import { defaultReportPeriod, isValidPeriod, periodRange, previousPeriod } from "./period";
import { buildAutoSummary } from "./summary";
import {
  REPORT_DATA_VERSION,
  isReportData,
  type AdsBlock,
  type Metric,
  type MonthlyReportData,
} from "./types";
import type { Json, TablesInsert } from "@/integrations/supabase/types";

const ACTIVE_STATUS = "activo";
export const DEFAULT_BATCH_LIMIT = 10;
export const MAX_BATCH_LIMIT = 15; // ~55 consultas por cliente; Workers permite 1000 subrequests por invocación
const CLIENT_CONCURRENCY = 3;

export const LEAD_SOURCE_LABEL: Readonly<Record<string, string>> = {
  whatsapp: "WhatsApp",
  landing: "Formulario web",
  meta_ads: "Anuncios Meta",
  multilink: "Multilink",
};

interface RawMonth {
  instagram: RawInstagram | null;
  landing: RawLanding | null;
  leads: RawLeads | null;
  bookings: number | null;
  meta: RawAds | null;
  google: RawAds | null;
  deliverables: Record<string, number> | null;
}

/** `detail`: series diarias y top posts (solo hacen falta para el mes reportado). */
async function collectMonth(clientId: string, period: string, detail: boolean): Promise<RawMonth> {
  const range = periodRange(period);
  const [instagram, landing, leads, bookings, meta, google, deliverables] = await Promise.all([
    collectInstagram(clientId, range),
    collectLanding(clientId, range, detail),
    collectLeads(clientId, range),
    collectBookings(clientId, range),
    collectMetaAds(clientId, range),
    collectGoogleAds(clientId, range),
    collectDeliverables(clientId, range),
  ]);
  return { instagram, landing, leads, bookings, meta, google, deliverables };
}

const metric = (value: number, previous: number | null | undefined): Metric => ({
  value,
  previous: previous ?? null,
});

const ratio = (cost: number, count: number) => (count > 0 ? cost / count : null);

function adsBlock(
  cur: RawAds,
  prev: RawAds | null,
  leads?: { cur: number; prev: number | null },
): AdsBlock {
  // Costos unitarios solo con una moneda en ambos meses.
  const sameCurrency =
    !cur.mixedCurrency && (!prev || (!prev.mixedCurrency && prev.currency === cur.currency));
  const prevComparable = sameCurrency ? prev : null;
  const cpa = sameCurrency ? ratio(cur.spend, cur.conversions) : null;
  const prevCpa = prevComparable ? ratio(prevComparable.spend, prevComparable.conversions) : null;

  const block: AdsBlock = {
    currency: cur.currency,
    spend: metric(cur.spend, prevComparable?.spend),
    impressions: cur.impressions,
    clicks: cur.clicks,
    conversions: metric(cur.conversions, prev?.conversions),
    cpa: cpa == null ? null : metric(cpa, prevCpa),
  };
  if (leads && leads.cur > 0) {
    block.leads = leads.cur;
    block.cpl = sameCurrency ? ratio(cur.spend, leads.cur) : null;
  }
  return block;
}

function instagramBlock(
  cur: RawInstagram,
  prev: RawInstagram | null,
): MonthlyReportData["instagram"] {
  const net = (r: RawInstagram | null) =>
    r?.followersEnd != null && r.followersStart != null ? r.followersEnd - r.followersStart : null;
  return {
    ...(cur.followersEnd != null && {
      followers: { value: cur.followersEnd, net_change: net(cur), previous_net_change: net(prev) },
    }),
    ...(cur.hasPostData && {
      post_views: metric(cur.views, prev?.hasPostData ? prev.views : null),
      interactions: metric(cur.interactions, prev?.hasPostData ? prev.interactions : null),
    }),
    top_posts: cur.topPosts,
  };
}

const sumValues = (r: Record<string, number>) => Object.values(r).reduce((s, n) => s + n, 0);

/** Snapshot completo del mes `period` para un cliente (sin guardar). */
export async function buildReportData(
  clientId: string,
  period: string,
): Promise<MonthlyReportData> {
  if (!isValidPeriod(period)) throw new Error(`Periodo inválido: ${period}`);
  const [cur, prev] = await Promise.all([
    collectMonth(clientId, period, true),
    collectMonth(clientId, previousPeriod(period), false),
  ]);

  const data: MonthlyReportData = {
    version: REPORT_DATA_VERSION,
    period,
    generated_at: new Date().toISOString(),
    auto_summary: "",
  };

  if (cur.instagram) data.instagram = instagramBlock(cur.instagram, prev.instagram);

  if (cur.landing || prev.landing) {
    const l = cur.landing;
    const contacts = (x: RawLanding | null) =>
      x ? x.whatsappClicks + x.contactClicks + x.formSubmits : 0;
    data.landing = {
      visits: metric(l?.visits ?? 0, prev.landing?.visits ?? null),
      contacts: metric(contacts(l), prev.landing ? contacts(prev.landing) : null),
      whatsapp_clicks: l?.whatsappClicks ?? 0,
      contact_clicks: l?.contactClicks ?? 0,
      form_submits: l?.formSubmits ?? 0,
      daily_visits: l?.dailyVisits ?? [],
    };
  }

  if (cur.leads || prev.leads) {
    const bySource = cur.leads?.bySource ?? {};
    data.leads = {
      total: metric(sumValues(bySource), prev.leads ? sumValues(prev.leads.bySource) : null),
      by_source: Object.entries(bySource)
        .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
        .map(([source, count]) => ({ source, label: LEAD_SOURCE_LABEL[source] ?? source, count })),
    };
  }

  if (cur.bookings != null || prev.bookings != null) {
    data.bookings = { total: metric(cur.bookings ?? 0, prev.bookings) };
  }

  if (cur.meta) {
    data.meta_ads = adsBlock(cur.meta, prev.meta, {
      cur: cur.leads?.metaAdsLeads ?? 0,
      prev: prev.leads?.metaAdsLeads ?? null,
    });
  }
  if (cur.google) data.google_ads = adsBlock(cur.google, prev.google);

  if (cur.deliverables) {
    data.deliverables = {
      completed: sumValues(cur.deliverables),
      by_type: Object.entries(cur.deliverables)
        .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
        .map(([type, count]) => ({ type, count })),
    };
  }

  data.auto_summary = buildAutoSummary(data);
  return data;
}

export interface GeneratedReport {
  clientId: string;
  period: string;
  id: string;
  created: boolean;
}

/** El reporte ya fue enviado: regenerarlo cambiaría lo que ve el cliente. */
export class ReportAlreadySentError extends Error {
  constructor() {
    super("Este reporte ya fue enviado; regenerarlo cambiará lo que ve el cliente.");
    this.name = "ReportAlreadySentError";
  }
}

export interface GenerateOptions {
  /** Permite regenerar un reporte ya enviado. */
  force?: boolean;
}

/** Fecha de la última generación del reporte (para limitar "Generar ahora"). */
export async function lastGeneratedAt(clientId: string, period: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("monthly_reports")
    .select("data")
    .eq("client_id", clientId)
    .eq("period", period)
    .maybeSingle();
  if (error) throw new Error(`[reports] lectura: ${error.message}`);
  return data && isReportData(data.data) ? data.data.generated_at : null;
}

/**
 * Genera (o regenera) el reporte del mes. No duplica: upsert por
 * client_id + period. Conserva el resumen si la agencia lo editó y no pisa
 * un reporte ya enviado salvo `force`.
 */
export async function generateMonthlyReport(
  clientId: string,
  period: string = defaultReportPeriod(),
  { force = false }: GenerateOptions = {},
): Promise<GeneratedReport> {
  const { data: existing, error: readErr } = await supabaseAdmin
    .from("monthly_reports")
    .select("id,summary,data,sent_at")
    .eq("client_id", clientId)
    .eq("period", period)
    .maybeSingle();
  if (readErr) throw new Error(`[reports] lectura: ${readErr.message}`);
  if (existing?.sent_at && !force) throw new ReportAlreadySentError();

  const data = await buildReportData(clientId, period);
  const previousAuto = existing && isReportData(existing.data) ? existing.data.auto_summary : null;
  const summaryUntouched = !existing?.summary?.trim() || existing.summary === previousAuto;
  const payload: TablesInsert<"monthly_reports"> = {
    client_id: clientId,
    period,
    data: data as unknown as Json,
    ...(summaryUntouched && { summary: data.auto_summary }),
  };

  // Sin "token" en el payload: lo genera la BD al insertar y no cambia al actualizar.
  const { data: saved, error } = await supabaseAdmin
    .from("monthly_reports")
    .upsert(payload, { onConflict: "client_id,period" })
    .select("id")
    .single();
  if (error) throw new Error(`[reports] guardado: ${error.message}`);
  return { clientId, period, id: saved.id, created: !existing };
}

export interface BatchOptions {
  period?: string;
  offset?: number;
  limit?: number;
  /** Solo este cliente (debe estar activo). */
  clientId?: string;
}

export interface MonthlyRunSummary {
  period: string;
  offset: number;
  clients: number;
  generated: number;
  /** Ya enviados: no se regeneran desde el cron. */
  skipped_sent: number;
  failed: number;
  errors: { clientId: string; message: string }[];
  /** Siguiente offset si quedan clientes; null si terminó. */
  next_offset: number | null;
}

/** Ejecuta `fn` sobre `items` con a lo más `concurrency` tareas a la vez. */
async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

/**
 * Genera el reporte del mes para un lote de clientes activos (orden estable por id).
 * Devuelve `next_offset` para que el cron llame de nuevo hasta que sea null.
 */
export async function generateReportsForActiveClients(
  opts: BatchOptions = {},
): Promise<MonthlyRunSummary> {
  const period = opts.period ?? defaultReportPeriod();
  if (!isValidPeriod(period)) throw new Error(`Periodo inválido: ${period}`);
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.min(MAX_BATCH_LIMIT, Math.max(1, opts.limit ?? DEFAULT_BATCH_LIMIT));

  let q = supabaseAdmin.from("clients").select("id").eq("status", ACTIVE_STATUS);
  if (opts.clientId) q = q.eq("id", opts.clientId);
  // Se pide uno extra para saber si quedan más.
  const { data: clients, error } = await q
    .order("id", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw new Error(`[reports] clientes: ${error.message}`);

  const batch = (clients ?? []).slice(0, limit);
  const results: { clientId: string; outcome: "ok" | "sent" | "error"; message?: string }[] = [];
  await runPool(batch, CLIENT_CONCURRENCY, async (c) => {
    try {
      await generateMonthlyReport(c.id, period);
      results.push({ clientId: c.id, outcome: "ok" });
    } catch (e) {
      if (e instanceof ReportAlreadySentError) {
        results.push({ clientId: c.id, outcome: "sent" });
        return;
      }
      const message = (e as Error).message;
      console.error("[reports] cliente falló", { clientId: c.id, period, message });
      results.push({ clientId: c.id, outcome: "error", message });
    }
  });

  const failed = results.filter((r) => r.outcome === "error");
  return {
    period,
    offset,
    clients: batch.length,
    generated: results.filter((r) => r.outcome === "ok").length,
    skipped_sent: results.filter((r) => r.outcome === "sent").length,
    failed: failed.length,
    errors: failed.map((r) => ({ clientId: r.clientId, message: r.message ?? "" })),
    next_offset: (clients ?? []).length > limit ? offset + limit : null,
  };
}
