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

const MAX_DELIVERABLE_ITEMS = 10;
const ACTIVE_STATUS = "activo";

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
  deliverables: { title: string; type: string }[] | null;
}

async function collectMonth(clientId: string, period: string): Promise<RawMonth> {
  const range = periodRange(period);
  const [instagram, landing, leads, bookings, meta, google, deliverables] = await Promise.all([
    collectInstagram(clientId, range),
    collectLanding(clientId, range),
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

function adsBlock(cur: RawAds, prev: RawAds | null, leads?: { cur: number; prev: number | null }): AdsBlock {
  // Costos unitarios solo con una moneda en ambos meses.
  const sameCurrency = !cur.mixedCurrency && (!prev || (!prev.mixedCurrency && prev.currency === cur.currency));
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

function instagramBlock(cur: RawInstagram, prev: RawInstagram | null): MonthlyReportData["instagram"] {
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
export async function buildReportData(clientId: string, period: string): Promise<MonthlyReportData> {
  if (!isValidPeriod(period)) throw new Error(`Periodo inválido: ${period}`);
  const [cur, prev] = await Promise.all([collectMonth(clientId, period), collectMonth(clientId, previousPeriod(period))]);

  const data: MonthlyReportData = {
    version: REPORT_DATA_VERSION,
    period,
    generated_at: new Date().toISOString(),
    auto_summary: "",
  };

  if (cur.instagram) data.instagram = instagramBlock(cur.instagram, prev.instagram);

  if (cur.landing || prev.landing) {
    const l = cur.landing;
    const contacts = (x: RawLanding | null) => (x ? x.whatsappClicks + x.contactClicks + x.formSubmits : 0);
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
      completed: cur.deliverables.length,
      items: cur.deliverables.slice(0, MAX_DELIVERABLE_ITEMS),
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

/**
 * Genera (o regenera) el reporte del mes. No duplica: upsert por
 * client_id + period. Conserva `sent_at` y el resumen si la agencia lo editó.
 */
export async function generateMonthlyReport(clientId: string, period: string = defaultReportPeriod()): Promise<GeneratedReport> {
  const data = await buildReportData(clientId, period);

  const { data: existing, error: readErr } = await supabaseAdmin
    .from("monthly_reports")
    .select("id,summary,data")
    .eq("client_id", clientId)
    .eq("period", period)
    .maybeSingle();
  if (readErr) throw new Error(`[reports] lectura: ${readErr.message}`);

  const previousAuto = existing && isReportData(existing.data) ? existing.data.auto_summary : null;
  const summaryUntouched = !existing?.summary?.trim() || existing.summary === previousAuto;
  const payload = {
    client_id: clientId,
    period,
    data: data as unknown as Record<string, unknown>,
    ...(summaryUntouched && { summary: data.auto_summary }),
  };

  // Sin "token" en el payload: lo genera la BD al insertar y no cambia al actualizar.
  const { data: saved, error } = await supabaseAdmin
    .from("monthly_reports")
    .upsert(payload as never, { onConflict: "client_id,period" })
    .select("id")
    .single();
  if (error) throw new Error(`[reports] guardado: ${error.message}`);
  return { clientId, period, id: (saved as { id: string }).id, created: !existing };
}

export interface MonthlyRunSummary {
  period: string;
  clients: number;
  generated: number;
  failed: number;
  errors: { clientId: string; message: string }[];
}

/** Genera el reporte del mes para todos los clientes con status = 'activo'. */
export async function generateReportsForActiveClients(period: string = defaultReportPeriod()): Promise<MonthlyRunSummary> {
  if (!isValidPeriod(period)) throw new Error(`Periodo inválido: ${period}`);
  const { data: clients, error } = await supabaseAdmin.from("clients").select("id").eq("status", ACTIVE_STATUS);
  if (error) throw new Error(`[reports] clientes: ${error.message}`);

  const summary: MonthlyRunSummary = { period, clients: clients?.length ?? 0, generated: 0, failed: 0, errors: [] };
  // En serie: cada cliente hace varias consultas y no queremos saturar la BD.
  for (const c of clients ?? []) {
    try {
      await generateMonthlyReport(c.id, period);
      summary.generated += 1;
    } catch (e) {
      const message = (e as Error).message;
      console.error("[reports] cliente falló", { clientId: c.id, period, message });
      summary.failed += 1;
      summary.errors.push({ clientId: c.id, message });
    }
  }
  return summary;
}
