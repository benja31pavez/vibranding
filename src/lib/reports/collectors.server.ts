/**
 * Lectores de cada fuente para el reporte mensual. Solo leen datos reales ya
 * guardados por la plataforma (nada se estima ni se inventa). Cada uno devuelve
 * null cuando la fuente no tiene datos para el rango.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addDays, chileDate, type PeriodRange } from "./period";
import type { TopPost } from "./types";

const PAGE_SIZE = 1000;
/** Tope de seguridad por consulta paginada. */
const MAX_ROWS = 100_000;
/** Ventana hacia atrás para encontrar la última medición previa de cada post. */
const POST_BASELINE_DAYS = 45;
const TOP_POSTS = 3;
const ID_CHUNK = 200;
const CANCELLED_BOOKING = "(cancelled,canceled,cancelada)";

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Lee todas las filas paginando de a 1000 (límite de PostgREST). */
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

const db = () => supabaseAdmin as any;
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

async function latestFollowers(clientId: string, op: "lte" | "lt", date: string, minDate?: string) {
  let q = db()
    .from("instagram_audience_snapshots")
    .select("date,followers_total")
    .eq("client_id", clientId)
    .not("followers_total", "is", null)
    [op]("date", date);
  if (minDate) q = q.gte("date", minDate);
  const { data, error } = await q.order("date", { ascending: false }).limit(1);
  if (error) throw new Error(`[reports] seguidores: ${error.message}`);
  const row = (data ?? [])[0];
  return row ? num(row.followers_total) : null;
}

interface PostRow {
  post_id: string;
  date: string;
  permalink: string | null;
  media_type: string | null;
  reach: number;
  engagement: number;
  saves: number;
}

export async function collectInstagram(clientId: string, range: PeriodRange): Promise<RawInstagram | null> {
  const [followersEnd, followersStart, rows] = await Promise.all([
    latestFollowers(clientId, "lte", range.lastDay, range.firstDay),
    latestFollowers(clientId, "lt", range.firstDay),
    fetchAll<PostRow>("posts", (from, to) =>
      db()
        .from("post_insights_daily")
        .select("post_id,date,permalink,media_type,reach,engagement,saves")
        .eq("client_id", clientId)
        .eq("platform", "instagram")
        .gte("date", addDays(range.firstDay, -POST_BASELINE_DAYS))
        .lte("date", range.lastDay)
        .order("date", { ascending: true })
        .order("post_id", { ascending: true })
        .range(from, to),
    ),
  ]);

  // Las métricas por post son acumuladas: lo ganado en el mes es la última
  // medición del mes menos la última medición anterior al mes.
  const lastIn = new Map<string, PostRow>();
  const base = new Map<string, PostRow>();
  for (const r of rows) {
    (r.date >= range.firstDay ? lastIn : base).set(r.post_id, r);
  }

  const posts: TopPost[] = [...lastIn.values()].map((r) => {
    const b = base.get(r.post_id);
    return {
      post_id: r.post_id,
      permalink: r.permalink,
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

export async function collectLanding(clientId: string, range: PeriodRange): Promise<RawLanding | null> {
  const rows = await fetchAll<{ event_name: string; created_at: string }>("landing_events", (from, to) =>
    db()
      .from("landing_events")
      .select("event_name,created_at")
      .eq("client_id", clientId)
      .gte("created_at", range.fromUtc)
      .lt("created_at", range.toUtc)
      .order("created_at", { ascending: true })
      .range(from, to),
  );
  if (rows.length === 0) return null;

  const count = (name: string) => rows.filter((r) => r.event_name === name).length;
  const perDay = new Map<string, number>();
  for (let d = range.firstDay; d <= range.lastDay; d = addDays(d, 1)) perDay.set(d, 0);
  for (const r of rows) {
    if (r.event_name !== "page_view") continue;
    const day = chileDate(r.created_at);
    if (perDay.has(day)) perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  return {
    visits: count("page_view"),
    whatsappClicks: count("whatsapp_click"),
    contactClicks: count("contact_click"),
    formSubmits: count("contact_submit"),
    dailyVisits: [...perDay.entries()].map(([date, visits]) => ({ date, visits })),
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
  for (let i = 0; i < conversationIds.length; i += ID_CHUNK) {
    const chunk = conversationIds.slice(i, i + ID_CHUNK);
    const { data, error } = await db()
      .from("attributions")
      .select("conversation_id")
      .eq("client_id", clientId)
      .in("conversation_id", chunk);
    if (error) throw new Error(`[reports] atribuciones: ${error.message}`);
    for (const r of data ?? []) if (r.conversation_id) attributed.add(String(r.conversation_id));
  }
  return attributed.size;
}

export async function collectLeads(clientId: string, range: PeriodRange): Promise<RawLeads | null> {
  const inRange = (q: any) => q.eq("client_id", clientId).gte("created_at", range.fromUtc).lt("created_at", range.toUtc);
  const [wa, forms, extra] = await Promise.all([
    fetchAll<{ id: string }>("whatsapp", (from, to) =>
      inRange(db().from("whatsapp_conversations").select("id"))
        .or("is_lead.eq.true,needs_human_followup.eq.true")
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    fetchAll<{ id: string }>("formularios", (from, to) =>
      inRange(db().from("landing_contact_submissions").select("id")).order("created_at", { ascending: true }).range(from, to),
    ),
    fetchAll<{ source: string }>("client_leads", (from, to) =>
      inRange(db().from("client_leads").select("source")).order("created_at", { ascending: true }).range(from, to),
    ),
  ]);

  const bySource: Record<string, number> = {};
  const add = (source: string, n: number) => {
    if (n > 0) bySource[source] = (bySource[source] ?? 0) + n;
  };
  add("whatsapp", wa.length);
  add("landing", forms.length);
  for (const r of extra) add(r.source || "otro", 1);
  if (Object.keys(bySource).length === 0) return null;

  const attributed = wa.length ? await countAttributed(clientId, wa.map((r) => r.id)) : 0;
  return { bySource, metaAdsLeads: (bySource.meta_ads ?? 0) + attributed };
}

// ───────────────────────── Reservas ─────────────────────────

export async function collectBookings(clientId: string, range: PeriodRange): Promise<number | null> {
  const { count, error } = await db()
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("scheduled_at", range.fromUtc)
    .lt("scheduled_at", range.toUtc)
    .not("status", "in", CANCELLED_BOOKING);
  if (error) throw new Error(`[reports] reservas: ${error.message}`);
  return count ? count : null;
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

export async function collectMetaAds(clientId: string, range: PeriodRange): Promise<RawAds | null> {
  const rows = await fetchAll<any>("meta_ads", (from, to) =>
    db()
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

  const currencies = new Set(rows.map((r) => String(r.currency ?? "CLP").toUpperCase()));
  return {
    currency: [...currencies][0] ?? "CLP",
    mixedCurrency: currencies.size > 1,
    spend: rows.reduce((s, r) => s + num(r.spend), 0),
    impressions: rows.reduce((s, r) => s + num(r.impressions), 0),
    clicks: rows.reduce((s, r) => s + num(r.clicks), 0),
    conversions: rows.reduce((s, r) => s + num(r.messaging_conversations_started), 0),
  };
}

export async function collectGoogleAds(clientId: string, range: PeriodRange): Promise<RawAds | null> {
  const rows = await fetchAll<any>("google_ads", (from, to) =>
    db()
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

export async function collectDeliverables(
  clientId: string,
  range: PeriodRange,
): Promise<{ title: string; type: string }[] | null> {
  // No hay fecha de cierre: se usa la última actualización de los marcados como listos.
  const rows = await fetchAll<{ title: string; type: string }>("entregables", (from, to) =>
    db()
      .from("deliverables")
      .select("title,type")
      .eq("client_id", clientId)
      .eq("status", "done")
      .gte("updated_at", range.fromUtc)
      .lt("updated_at", range.toUtc)
      .order("updated_at", { ascending: true })
      .range(from, to),
  );
  return rows.length ? rows : null;
}
