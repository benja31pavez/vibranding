/**
 * Lectores de cada fuente para el reporte mensual. Solo leen datos reales ya
 * guardados por la plataforma (nada se estima ni se inventa). Cada uno devuelve
 * null cuando la fuente no tiene datos para el rango.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addDays, chileMidnightUtc, type PeriodRange } from "./period";
import type { TopPost } from "./types";

const PAGE_SIZE = 1000;
/** Tope de seguridad por consulta paginada (fuentes de bajo volumen). */
const MAX_ROWS = 20_000;
const TOP_POSTS = 3;
const ID_CHUNK = 200;
/** Consultas de conteo por día en paralelo. */
const DAY_COUNT_CONCURRENCY = 6;
const CANCELLED_BOOKING = "(cancelled,canceled,cancelada)";
const SAFE_PERMALINK = /^https:\/\/(www\.)?instagram\.com\//;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Lee todas las filas paginando de a 1000 (límite de PostgREST), con tope. */
async function fetchAll<T>(label: string, page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`[reports] ${label}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
  console.warn(`[reports] ${label}: se alcanzó el tope de ${MAX_ROWS} filas`);
  return rows;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function exactCount(label: string, res: { count: number | null; error: { message: string } | null }): number {
  if (res.error) throw new Error(`[reports] ${label}: ${res.error.message}`);
  return res.count ?? 0;
}

const num = (v: unknown) => Number(v) || 0;

// ───────────────────────── Instagram ─────────────────────────

export interface RawInstagram {
  followersEnd: number | null;
  followersStart: number | null;
  views: number;
  interactions: number;
  hasPostData: boolean;
  topPosts: TopPost[];
}

async function latestFollowers(clientId: string, range: PeriodRange, when: "end" | "start"): Promise<number | null> {
  const base = supabaseAdmin
    .from("instagram_audience_snapshots")
    .select("date,followers_total")
    .eq("client_id", clientId)
    .not("followers_total", "is", null);
  const q =
    when === "end"
      ? base.gte("date", range.firstDay).lte("date", range.lastDay)
      : base.lt("date", range.firstDay);
  const { data, error } = await q.order("date", { ascending: false }).limit(1);
  if (error) throw new Error(`[reports] seguidores: ${error.message}`);
  const row = (data ?? [])[0];
  return row?.followers_total != null ? num(row.followers_total) : null;
}

type PostMetrics = { post_id: string; reach: number; engagement: number; saves: number };
type PostRow = PostMetrics & { date: string; permalink: string | null; media_type: string | null };

/** Última medición anterior al mes de cada post (sin límite inferior de fecha). */
async function postBaselines(clientId: string, postIds: string[], before: string): Promise<Map<string, PostMetrics>> {
  const base = new Map<string, PostMetrics>();
  for (const ids of chunks(postIds, ID_CHUNK)) {
    // Cada post se mide solo ~30 días tras publicarse, así que esto es acotado.
    const rows = await fetchAll<PostMetrics & { date: string }>("posts base", (from, to) =>
      supabaseAdmin
        .from("post_insights_daily")
        .select("post_id,date,reach,engagement,saves")
        .eq("client_id", clientId)
        .in("post_id", ids)
        .lt("date", before)
        .order("date", { ascending: true })
        .order("post_id", { ascending: true })
        .range(from, to),
    );
    for (const r of rows) base.set(r.post_id, r);
  }
  return base;
}

export async function collectInstagram(clientId: string, range: PeriodRange): Promise<RawInstagram | null> {
  const [followersEnd, followersStart, rows] = await Promise.all([
    latestFollowers(clientId, range, "end"),
    latestFollowers(clientId, range, "start"),
    fetchAll<PostRow>("posts", (from, to) =>
      supabaseAdmin
        .from("post_insights_daily")
        .select("post_id,date,permalink,media_type,reach,engagement,saves")
        .eq("client_id", clientId)
        .eq("platform", "instagram")
        .gte("date", range.firstDay)
        .lte("date", range.lastDay)
        .order("date", { ascending: true })
        .order("post_id", { ascending: true })
        .range(from, to),
    ),
  ]);

  // Métricas acumuladas: lo ganado en el mes = última medición del mes − última previa.
  const lastIn = new Map<string, PostRow>();
  for (const r of rows) lastIn.set(r.post_id, r);
  const base = await postBaselines(clientId, [...lastIn.keys()], range.firstDay);

  const posts: TopPost[] = [...lastIn.values()].map((r) => {
    const b = base.get(r.post_id);
    return {
      post_id: r.post_id,
      permalink: r.permalink && SAFE_PERMALINK.test(r.permalink) ? r.permalink : null,
      media_type: r.media_type,
      views: Math.max(0, num(r.reach) - num(b?.reach)),
      interactions: Math.max(0, num(r.engagement) - num(b?.engagement)),
      saves: Math.max(0, num(r.saves) - num(b?.saves)),
    };
  });

  if (followersEnd == null && posts.length === 0) return null;

  const topPosts = [...posts]
    .filter((p) => p.views > 0 || p.interactions > 0)
    .sort((a, b) => b.interactions - a.interactions || b.views - a.views || a.post_id.localeCompare(b.post_id))
    .slice(0, TOP_POSTS);

  return {
    followersEnd,
    followersStart,
    views: posts.reduce((s, p) => s + p.views, 0),
    interactions: posts.reduce((s, p) => s + p.interactions, 0),
    hasPostData: posts.length > 0,
    topPosts,
  };
}

// ───────────────────────── Landing ─────────────────────────

export interface RawLanding {
  visits: number;
  whatsappClicks: number;
  contactClicks: number;
  formSubmits: number;
  dailyVisits: { date: string; visits: number }[];
}

function countEvents(clientId: string, event: string, fromUtc: string, toUtc: string) {
  return supabaseAdmin
    .from("landing_events")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("event_name", event)
    .gte("created_at", fromUtc)
    .lt("created_at", toUtc);
}

/** Visitas por día con conteos exactos (sin traer filas), en lotes acotados. */
async function dailyVisits(clientId: string, range: PeriodRange): Promise<{ date: string; visits: number }[]> {
  const days: string[] = [];
  for (let d = range.firstDay; d <= range.lastDay; d = addDays(d, 1)) days.push(d);
  const out: { date: string; visits: number }[] = [];
  for (const batch of chunks(days, DAY_COUNT_CONCURRENCY)) {
    const counts = await Promise.all(
      batch.map(async (date) =>
        exactCount(
          "visitas por día",
          await countEvents(clientId, "page_view", chileMidnightUtc(date), chileMidnightUtc(addDays(date, 1))),
        ),
      ),
    );
    batch.forEach((date, i) => out.push({ date, visits: counts[i] }));
  }
  return out;
}

export async function collectLanding(
  clientId: string,
  range: PeriodRange,
  withDaily: boolean,
): Promise<RawLanding | null> {
  const names = ["page_view", "whatsapp_click", "contact_click", "contact_submit"] as const;
  const counts = await Promise.all(
    names.map(async (n) => exactCount(`landing ${n}`, await countEvents(clientId, n, range.fromUtc, range.toUtc))),
  );
  const [visits, whatsappClicks, contactClicks, formSubmits] = counts;
  if (counts.every((c) => c === 0)) return null;
  return {
    visits,
    whatsappClicks,
    contactClicks,
    formSubmits,
    dailyVisits: withDaily && visits > 0 ? await dailyVisits(clientId, range) : [],
  };
}

// ───────────────────────── Leads ─────────────────────────

export interface RawLeads {
  bySource: Record<string, number>;
  /** Leads que vienen de anuncios de Meta (carga manual + WhatsApp atribuido a un anuncio). */
  metaAdsLeads: number;
}

async function countAttributed(clientId: string, conversationIds: string[]): Promise<number> {
  const attributed = new Set<string>();
  for (const ids of chunks(conversationIds, ID_CHUNK)) {
    const { data, error } = await supabaseAdmin
      .from("attributions")
      .select("conversation_id")
      .eq("client_id", clientId)
      .in("conversation_id", ids);
    if (error) throw new Error(`[reports] atribuciones: ${error.message}`);
    for (const r of data ?? []) if (r.conversation_id) attributed.add(r.conversation_id);
  }
  return attributed.size;
}

export async function collectLeads(clientId: string, range: PeriodRange): Promise<RawLeads | null> {
  const [wa, forms, extra] = await Promise.all([
    fetchAll<{ id: string }>("whatsapp", (from, to) =>
      supabaseAdmin
        .from("whatsapp_conversations")
        .select("id")
        .eq("client_id", clientId)
        .gte("created_at", range.fromUtc)
        .lt("created_at", range.toUtc)
        .or("is_lead.eq.true,needs_human_followup.eq.true")
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    supabaseAdmin
      .from("landing_contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gte("created_at", range.fromUtc)
      .lt("created_at", range.toUtc),
    fetchAll<{ source: string }>("client_leads", (from, to) =>
      supabaseAdmin
        .from("client_leads")
        .select("source")
        .eq("client_id", clientId)
        .gte("created_at", range.fromUtc)
        .lt("created_at", range.toUtc)
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
  ]);

  const bySource: Record<string, number> = {};
  const add = (source: string, n: number) => {
    if (n > 0) bySource[source] = (bySource[source] ?? 0) + n;
  };
  add("whatsapp", wa.length);
  add("landing", exactCount("formularios", forms));
  for (const r of extra) add(r.source || "otro", 1);
  if (Object.keys(bySource).length === 0) return null;

  const attributed = wa.length ? await countAttributed(clientId, wa.map((r) => r.id)) : 0;
  return { bySource, metaAdsLeads: (bySource.meta_ads ?? 0) + attributed };
}

// ───────────────────────── Reservas ─────────────────────────

export async function collectBookings(clientId: string, range: PeriodRange): Promise<number | null> {
  const count = exactCount(
    "reservas",
    await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gte("scheduled_at", range.fromUtc)
      .lt("scheduled_at", range.toUtc)
      .not("status", "in", CANCELLED_BOOKING),
  );
  return count || null;
}

// ───────────────────────── Anuncios ─────────────────────────

export interface RawAds {
  currency: string;
  /** Más de una moneda: no se suman ni se calculan costos unitarios. */
  mixedCurrency: boolean;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

type MetaRow = {
  spend: number;
  impressions: number;
  clicks: number;
  messaging_conversations_started: number;
  currency: string | null;
};

export async function collectMetaAds(clientId: string, range: PeriodRange): Promise<RawAds | null> {
  const rows = await fetchAll<MetaRow>("meta_ads", (from, to) =>
    supabaseAdmin
      .from("ad_insights_daily")
      .select("spend,impressions,clicks,messaging_conversations_started,currency")
      .eq("client_id", clientId)
      .eq("level", "ad")
      .gte("date", range.firstDay)
      .lte("date", range.lastDay)
      .order("date", { ascending: true })
      .order("entity_id", { ascending: true })
      .range(from, to),
  );
  if (rows.length === 0) return null;

  const currencies = new Set(rows.map((r) => (r.currency ?? "CLP").toUpperCase()));
  return {
    currency: [...currencies][0] ?? "CLP",
    mixedCurrency: currencies.size > 1,
    spend: rows.reduce((s, r) => s + num(r.spend), 0),
    impressions: rows.reduce((s, r) => s + num(r.impressions), 0),
    clicks: rows.reduce((s, r) => s + num(r.clicks), 0),
    conversions: rows.reduce((s, r) => s + num(r.messaging_conversations_started), 0),
  };
}

type GoogleRow = { cost_clp: number; impressions: number; clicks: number; conversions: number };

export async function collectGoogleAds(clientId: string, range: PeriodRange): Promise<RawAds | null> {
  const rows = await fetchAll<GoogleRow>("google_ads", (from, to) =>
    supabaseAdmin
      .from("google_ads_insights_daily")
      .select("cost_clp,impressions,clicks,conversions")
      .eq("client_id", clientId)
      .gte("date", range.firstDay)
      .lte("date", range.lastDay)
      .order("date", { ascending: true })
      .order("campaign_id", { ascending: true })
      .range(from, to),
  );
  if (rows.length === 0) return null;
  return {
    currency: "CLP",
    mixedCurrency: false,
    spend: rows.reduce((s, r) => s + num(r.cost_clp), 0),
    impressions: rows.reduce((s, r) => s + num(r.impressions), 0),
    clicks: rows.reduce((s, r) => s + num(r.clicks), 0),
    conversions: rows.reduce((s, r) => s + num(r.conversions), 0),
  };
}

// ───────────────────────── Entregables ─────────────────────────

/**
 * Conteo por tipo de entregables marcados como listos en el mes. Los títulos son
 * internos y no hay marca de "público", así que no se guardan (el reporte es público).
 */
export async function collectDeliverables(clientId: string, range: PeriodRange): Promise<Record<string, number> | null> {
  const rows = await fetchAll<{ type: string }>("entregables", (from, to) =>
    supabaseAdmin
      .from("deliverables")
      .select("type")
      .eq("client_id", clientId)
      .eq("status", "done")
      .gte("updated_at", range.fromUtc)
      .lt("updated_at", range.toUtc)
      .order("updated_at", { ascending: true })
      .range(from, to),
  );
  if (rows.length === 0) return null;
  const byType: Record<string, number> = {};
  for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1;
  return byType;
}
