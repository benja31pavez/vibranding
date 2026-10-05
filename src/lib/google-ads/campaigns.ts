// Agregación de google_ads_insights_daily para la tabla de campañas (navegador).

export type InsightRow = {
  campaign_id: string;
  campaign_name: string | null;
  date: string;
  clicks: number | string;
  cost_clp: number | string;
  conversions: number | string;
};

export type CampaignSummary = {
  campaignId: string;
  name: string;
  costClp: number;
  clicks: number;
  conversions: number;
  /** null cuando no hubo conversiones (no se divide por cero). */
  costPerConversion: number | null;
};

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/** Suma por campaña, ordenado por gasto descendente. Usa el nombre más reciente. */
export function summarizeCampaigns(rows: InsightRow[]): CampaignSummary[] {
  const byId = new Map<string, CampaignSummary & { lastDate: string }>();
  for (const r of rows) {
    const prev = byId.get(r.campaign_id);
    const newer = !prev || r.date >= prev.lastDate;
    byId.set(r.campaign_id, {
      campaignId: r.campaign_id,
      name: (newer ? r.campaign_name : prev?.name) || prev?.name || `Campaña ${r.campaign_id}`,
      lastDate: newer ? r.date : (prev?.lastDate ?? r.date),
      costClp: (prev?.costClp ?? 0) + n(r.cost_clp),
      clicks: (prev?.clicks ?? 0) + n(r.clicks),
      conversions: (prev?.conversions ?? 0) + n(r.conversions),
      costPerConversion: null,
    });
  }
  return [...byId.values()]
    .map(({ lastDate: _lastDate, ...c }) => ({
      ...c,
      costClp: Math.round(c.costClp),
      conversions: Math.round(c.conversions * 100) / 100,
      costPerConversion: c.conversions > 0 ? Math.round(c.costClp / c.conversions) : null,
    }))
    .sort((a, b) => b.costClp - a.costClp);
}
