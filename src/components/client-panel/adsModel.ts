/**
 * Publicidad del cliente (lógica pura): valida la respuesta de los RPC
 * client_meta_ads_summary / client_google_ads_summary y define los textos.
 * Sin red ni React, para probarlo en scripts/check-panel-sitio-ads.mjs.
 */
import { metaBillingLabel, type MetaBillingReason } from "@/lib/ads-billing/metaStatus";

export type AdsPlatformKey = "meta" | "google";

/** Períodos que puede elegir el cliente (días, hoy incluido). */
export const ADS_PERIODS = [7, 30, 90] as const;
export type AdsPeriod = (typeof ADS_PERIODS)[number];
export const DEFAULT_ADS_PERIOD: AdsPeriod = 30;

export type CampaignStatus = "activa" | "pausada" | "finalizada" | "sin_entrega" | "sin_dato";
export type AdsBillingState = "verificado" | "pendiente" | "rechazado";

export interface AdsTotals {
  spend: number;
  impressions: number;
  /** Solo Meta (suma diaria por anuncio). */
  reach: number | null;
  clicks: number;
  results: number;
  costPerResult: number | null;
}

export interface AdsCampaign extends AdsTotals {
  name: string;
  status: CampaignStatus;
}

export type ClientAdsSummary =
  | { connected: false; days: number }
  | {
      connected: true;
      days: number;
      currency: string;
      lastSyncedAt: string | null;
      billingState: AdsBillingState;
      /** Detalle de Meta (null si no hay chequeo); Google no lo tiene. */
      billingDetail: string | null;
      totals: AdsTotals;
      campaigns: AdsCampaign[];
    };

export const PLATFORM_COPY: Readonly<
  Record<AdsPlatformKey, { title: string; results: string; resultsHint: string }>
> = {
  meta: {
    title: "Meta Ads",
    results: "Conversaciones",
    resultsHint: "Conversaciones iniciadas por WhatsApp, Messenger o Instagram.",
  },
  google: {
    title: "Google Ads",
    results: "Conversiones",
    resultsHint: "Acciones que Google Ads cuenta como conversión (llamadas, formularios, compras).",
  },
};

export const CAMPAIGN_STATUS: Readonly<
  Record<CampaignStatus, { label: string; tone: "success" | "warning" | "neutral" }>
> = {
  activa: { label: "Activa", tone: "success" },
  pausada: { label: "Pausada", tone: "warning" },
  finalizada: { label: "Finalizada", tone: "neutral" },
  sin_entrega: { label: "Sin entrega reciente", tone: "neutral" },
  sin_dato: { label: "Con resultados", tone: "neutral" },
};

export const BILLING_STATE: Readonly<
  Record<AdsBillingState, { label: string; tone: "success" | "warning" | "danger" }>
> = {
  verificado: { label: "Pago de pauta al día", tone: "success" },
  pendiente: { label: "Pago de pauta por verificar", tone: "warning" },
  rechazado: { label: "Revisa el pago de tu pauta", tone: "danger" },
};

/** Dónde revisa el cliente la tarjeta de SU cuenta (sin ids). */
export const BILLING_HELP_URL: Readonly<Record<AdsPlatformKey, string>> = {
  meta: "https://business.facebook.com/billing_hub",
  google: "https://ads.google.com/aw/billing/summary",
};

const STATUSES = new Set<string>(Object.keys(CAMPAIGN_STATUS));
const BILLING_STATES = new Set<string>(Object.keys(BILLING_STATE));
const META_REASONS = new Set<string>([
  "ok",
  "disabled",
  "unsettled",
  "pending_review",
  "pending_settlement",
  "grace_period",
  "closed",
  "no_funding",
  "funding_unknown",
  "unknown_status",
]);
const MAX_CAMPAIGNS = 20;

type Obj = Record<string, unknown>;

function asObj(v: unknown): Obj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function optNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function totals(raw: unknown, platform: AdsPlatformKey): AdsTotals {
  const o = asObj(raw) ?? {};
  return {
    spend: Math.round(num(o.spend)),
    impressions: Math.round(num(o.impressions)),
    reach: platform === "meta" ? Math.round(num(o.reach)) : null,
    clicks: Math.round(num(o.clicks)),
    results: Math.round(num(o.results) * 100) / 100,
    costPerResult: optNum(o.cost_per_result),
  };
}

function campaign(raw: unknown, platform: AdsPlatformKey): AdsCampaign | null {
  const o = asObj(raw);
  if (!o) return null;
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : "Campaña sin nombre";
  const status = typeof o.status === "string" && STATUSES.has(o.status) ? o.status : "sin_dato";
  return { ...totals(o, platform), name, status: status as CampaignStatus };
}

/** Respuesta del RPC → modelo (null = la sesión no es de un usuario cliente). */
export function parseAdsSummary(raw: unknown, platform: AdsPlatformKey): ClientAdsSummary | null {
  const o = asObj(raw);
  if (!o) return null;
  const days = Math.round(num(o.days)) || DEFAULT_ADS_PERIOD;
  if (o.connected !== true) return { connected: false, days };
  const state =
    typeof o.billing_state === "string" && BILLING_STATES.has(o.billing_state)
      ? (o.billing_state as AdsBillingState)
      : "pendiente";
  const reason =
    platform === "meta" &&
    typeof o.billing_reason === "string" &&
    META_REASONS.has(o.billing_reason)
      ? metaBillingLabel(o.billing_reason as MetaBillingReason)
      : null;
  const list = Array.isArray(o.campaigns) ? o.campaigns : [];
  return {
    connected: true,
    days,
    currency: typeof o.currency === "string" && o.currency ? o.currency : "CLP",
    lastSyncedAt:
      typeof o.last_synced_at === "string" && !Number.isNaN(Date.parse(o.last_synced_at))
        ? o.last_synced_at
        : null,
    billingState: state,
    billingDetail: state === "verificado" ? null : reason,
    totals: totals(o.totals, platform),
    campaigns: list
      .slice(0, MAX_CAMPAIGNS)
      .map((c) => campaign(c, platform))
      .filter((c): c is AdsCampaign => c !== null),
  };
}

/** 12345 → "12.345" (es-CL). Conversiones de Google pueden traer decimales. */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(n);
}

/** "Actualizado hace 3 h" / "hace 2 días" (null si no hay fecha). */
export function syncedAgo(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const ms = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "Actualizado hace menos de 1 h";
  if (h < 24) return `Actualizado hace ${h} h`;
  const d = Math.floor(h / 24);
  return `Actualizado hace ${d} ${d === 1 ? "día" : "días"}`;
}
