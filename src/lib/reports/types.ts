/**
 * Forma de `monthly_reports.data`. Cada bloque es opcional: si una fuente no
 * tiene datos reales para el mes (ni el anterior), el bloque no se guarda.
 * `previous` es el valor del mes anterior (null si no hay con qué comparar).
 */
export const REPORT_DATA_VERSION = 1;

export interface Metric {
  value: number;
  previous: number | null;
}

export interface TopPost {
  post_id: string;
  permalink: string | null;
  media_type: string | null;
  views: number;
  interactions: number;
  saves: number;
}

export interface InstagramBlock {
  /** Seguidores al cierre del mes y variación neta en el mes. */
  followers?: { value: number; net_change: number | null; previous_net_change: number | null };
  /** Visualizaciones ganadas en el mes por las publicaciones con métricas. */
  post_views?: Metric;
  /** Interacciones (me gusta, comentarios, guardados, compartidos) ganadas en el mes. */
  interactions?: Metric;
  top_posts: TopPost[];
}

export interface LandingBlock {
  visits: Metric;
  /** Clicks a WhatsApp + clicks de contacto + formularios enviados. */
  contacts: Metric;
  whatsapp_clicks: number;
  contact_clicks: number;
  form_submits: number;
  daily_visits: { date: string; visits: number }[];
}

export interface LeadsBlock {
  total: Metric;
  by_source: { source: string; label: string; count: number }[];
}

export interface BookingsBlock {
  total: Metric;
}

export interface AdsBlock {
  currency: string;
  spend: Metric;
  impressions: number;
  clicks: number;
  /** Meta: conversaciones iniciadas; Google: conversiones registradas. */
  conversions: Metric;
  /** Costo por conversión (null si no hubo conversiones). */
  cpa: Metric | null;
  /** Solo Meta: leads atribuidos a anuncios y costo por lead. */
  leads?: number;
  cpl?: number | null;
}

/** Solo conteos: los títulos de entregables son internos y el reporte es público. */
export interface DeliverablesBlock {
  completed: number;
  by_type: { type: string; count: number }[];
}

export interface MonthlyReportData {
  version: number;
  period: string;
  generated_at: string;
  instagram?: InstagramBlock;
  landing?: LandingBlock;
  leads?: LeadsBlock;
  bookings?: BookingsBlock;
  meta_ads?: AdsBlock;
  google_ads?: AdsBlock;
  deliverables?: DeliverablesBlock;
  /** Resumen automático; permite saber si la agencia editó `summary`. */
  auto_summary: string;
}

export function isReportData(value: unknown): value is MonthlyReportData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.version === "number" && typeof v.period === "string";
}
