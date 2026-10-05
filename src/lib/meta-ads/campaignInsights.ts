/**
 * La sincronización de Meta guarda métricas a nivel anuncio (level = 'ad'):
 * varias filas por campaña y día. Para mostrarlas por campaña se agregan aquí.
 * Puro (sin E/S): se prueba en scripts/check-briefing.mjs.
 */

export interface AdInsightRow {
  campaign_id: string | null;
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  messaging_conversations_started: number;
}

export interface CampaignDayInsight {
  /** `${campaign_id}:${date}` (estable para keys de React). */
  id: string;
  campaign_id: string;
  date: string;
  impressions: number;
  /** Suma del alcance de cada anuncio: puede contar personas repetidas. */
  reach: number;
  clicks: number;
  /** % calculado sobre los totales (null sin impresiones). */
  ctr: number | null;
  spend: number;
  /** Costo por mil impresiones calculado sobre los totales (null sin impresiones). */
  cpm: number | null;
  messaging_conversations_started: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Suma filas de anuncio por (campaña, día); orden: fecha desc. Sin campaña → se omite. */
export function aggregateByCampaignDay(rows: readonly AdInsightRow[]): CampaignDayInsight[] {
  const groups = new Map<string, Omit<CampaignDayInsight, "ctr" | "cpm">>();
  for (const r of rows) {
    if (!r.campaign_id) continue;
    const id = `${r.campaign_id}:${r.date}`;
    const prev = groups.get(id) ?? {
      id,
      campaign_id: r.campaign_id,
      date: r.date,
      impressions: 0,
      reach: 0,
      clicks: 0,
      spend: 0,
      messaging_conversations_started: 0,
    };
    groups.set(id, {
      ...prev,
      impressions: prev.impressions + num(r.impressions),
      reach: prev.reach + num(r.reach),
      clicks: prev.clicks + num(r.clicks),
      spend: prev.spend + num(r.spend),
      messaging_conversations_started:
        prev.messaging_conversations_started + num(r.messaging_conversations_started),
    });
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      spend: round2(g.spend),
      ctr: g.impressions > 0 ? round2((g.clicks / g.impressions) * 100) : null,
      cpm: g.impressions > 0 ? round2((g.spend / g.impressions) * 1000) : null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.campaign_id.localeCompare(b.campaign_id));
}
