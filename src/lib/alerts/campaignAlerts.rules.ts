/**
 * Reglas deterministas de alertas de campañas (Meta Ads).
 *
 * Funciones puras: reciben una foto de los datos ya guardados (insights
 * diarios, campañas, estado de la conexión) y devuelven las alertas que
 * deberían estar abiertas. No leen ni escriben la BD y nunca tocan Meta.
 * Los umbrales están en ./campaignAlerts.config.ts.
 */
import {
  BUDGET_MISMATCH_RATIO,
  CPA_BASELINE_DAYS,
  CPA_MIN_BASELINE_RESULTS,
  CPA_RECENT_DAYS,
  CPA_RISE_CRITICAL,
  CPA_RISE_WARNING,
  ENABLE_BUDGET_RULES,
  INGEST_STALE_HOURS,
  NO_RESULTS_WINDOW_DAYS,
  OBJECTIVES_WITHOUT_RESULTS,
  OVERSPEND_CRITICAL_RATIO,
  OVERSPEND_WARNING_RATIO,
  SPEND_THRESHOLDS,
  TOKEN_EXPIRY_WARNING_DAYS,
  ZERO_SPEND_DAYS,
  type SpendThresholds,
} from "./campaignAlerts.config";

export const ALERT_KINDS = [
  "meta_connection",
  "ingest_stale",
  "spend_no_results",
  "cpa_spike",
  "zero_spend_active",
  "overspend",
  "budget_mismatch",
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];
export type AlertSeverity = "info" | "warning" | "critical";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const ADS_MANAGER_BASE = "https://adsmanager.facebook.com/adsmanager/manage/campaigns";

export interface AccountSnapshot {
  id: string;
  adAccountId: string | null;
  currency: string | null;
  tokenValid: boolean | null;
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
  lastIngestAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

/** Totales de una campaña en un día (ya sumados desde los anuncios). */
export interface CampaignDay {
  date: string;
  campaignId: string;
  campaignName: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  /** Conversaciones iniciadas (Meta) + conversaciones de WhatsApp atribuidas a sus anuncios. */
  results: number;
}

/** Campaña guardada en la plataforma (meta_ads_campaigns) con su presupuesto esperado. */
export interface CampaignPlan {
  fbCampaignId: string;
  name: string;
  status: string;
  objective: string | null;
  /** Presupuesto diario esperado: el de la campaña (CBO) o la suma de sus conjuntos activos. */
  expectedDailyBudget: number | null;
  startTime: string | null;
  stopTime: string | null;
}

export interface EvaluationInput {
  clientId: string;
  now: Date;
  /** Último día cerrado en la zona horaria de la cuenta publicitaria (YYYY-MM-DD). */
  referenceDay: string;
  account: AccountSnapshot;
  days: CampaignDay[];
  campaigns: CampaignPlan[];
  /** Leads de anuncios cargados a mano (sin campaña) en la ventana de "sin resultados". */
  unattributedMetaLeads: number;
}

export interface AlertCandidate {
  kind: AlertKind;
  severity: AlertSeverity;
  dedupeKey: string;
  message: string;
  data: Record<string, unknown>;
}

export interface EvaluationResult {
  candidates: AlertCandidate[];
  /** Reglas que sí se evaluaron: solo sus alertas abiertas pueden auto-resolverse. */
  evaluated: AlertKind[];
}

// ───────────────────────── utilidades ─────────────────────────

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Los `n` días que terminan en `lastDay` (inclusive), del más antiguo al más reciente. */
export function dayRange(lastDay: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDaysIso(lastDay, i - (n - 1)));
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "CLP" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

const pct = (ratio: number) => `${Math.round(ratio * 100)} %`;
const times = (ratio: number) => `${ratio.toFixed(1).replace(".", ",")}×`;
/** "2026-10-04" → "04/10". */
const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Link al Administrador de anuncios de la cuenta (y a la campaña, si se indica). */
export function adsManagerUrl(adAccountId: string | null, campaignId?: string): string | null {
  const act = adAccountId?.replace(/^act_/, "");
  if (!act || !/^\d+$/.test(act)) return null;
  const params = new URLSearchParams({ act });
  if (campaignId && /^\d+$/.test(campaignId)) params.set("selected_campaign_ids", campaignId);
  return `${ADS_MANAGER_BASE}?${params.toString()}`;
}

interface CampaignTotals {
  campaignId: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
}

function totals(days: CampaignDay[], campaignId: string, window: readonly string[], name: string): CampaignTotals {
  const inWindow = new Set(window);
  return days
    .filter((d) => d.campaignId === campaignId && inWindow.has(d.date))
    .reduce<CampaignTotals>(
      (acc, d) => ({
        ...acc,
        spend: acc.spend + d.spend,
        impressions: acc.impressions + d.impressions,
        clicks: acc.clicks + d.clicks,
        results: acc.results + d.results,
      }),
      { campaignId, name, spend: 0, impressions: 0, clicks: 0, results: 0 },
    );
}

function campaignNames(days: CampaignDay[], campaigns: CampaignPlan[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const c of campaigns) names.set(c.fbCampaignId, c.name);
  for (const d of days) if (d.campaignName && !names.has(d.campaignId)) names.set(d.campaignId, d.campaignName);
  return names;
}

// ───────────────────────── reglas de cuenta ─────────────────────────

function connectionAlert(input: EvaluationInput): AlertCandidate | null {
  const { account, now } = input;
  const base = {
    kind: "meta_connection" as const,
    dedupeKey: "meta_connection",
    data: { meta_account_id: account.id, ads_manager_url: adsManagerUrl(account.adAccountId) },
  };
  const expiresAt = account.tokenExpiresAt ? Date.parse(account.tokenExpiresAt) : NaN;

  if (account.tokenValid === false) {
    return {
      ...base,
      severity: "critical",
      message:
        "La conexión con Meta dejó de funcionar (el permiso ya no es válido). Reconecta Meta desde Configurar cliente: mientras tanto no llegan datos de las campañas.",
    };
  }
  if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) {
    return {
      ...base,
      severity: "critical",
      message: "El permiso de Meta de este cliente venció. Reconecta Meta desde Configurar cliente para volver a recibir datos.",
      data: { ...base.data, token_expires_at: account.tokenExpiresAt },
    };
  }
  if (Number.isFinite(expiresAt) && expiresAt - now.getTime() <= TOKEN_EXPIRY_WARNING_DAYS * DAY_MS) {
    const daysLeft = Math.max(1, Math.ceil((expiresAt - now.getTime()) / DAY_MS));
    return {
      ...base,
      severity: "warning",
      message: `El permiso de Meta vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}. Reconecta Meta desde Configurar cliente antes de que se corte la sincronización.`,
      data: { ...base.data, token_expires_at: account.tokenExpiresAt },
    };
  }
  if (account.lastSyncError) {
    return {
      ...base,
      severity: "warning",
      message: `La última sincronización con Meta falló: «${account.lastSyncError.slice(0, 160)}». Revisa la conexión en Configurar cliente; si el error menciona permisos o pago, resuélvelo en Meta.`,
      data: { ...base.data, last_sync_error: account.lastSyncError.slice(0, 500) },
    };
  }
  return null;
}

function lastSuccessfulSync(account: AccountSnapshot): number {
  const times = [account.lastSyncedAt, account.lastIngestAt]
    .map((t) => (t ? Date.parse(t) : NaN))
    .filter(Number.isFinite);
  return times.length ? Math.max(...times) : NaN;
}

function staleAlert(input: EvaluationInput): AlertCandidate | null {
  const { account, now } = input;
  const limit = now.getTime() - INGEST_STALE_HOURS * HOUR_MS;
  const last = lastSuccessfulSync(account);
  const connectedLongAgo = Date.parse(account.createdAt) <= limit;
  const stale = Number.isFinite(last) ? last <= limit : connectedLongAgo;
  if (!stale) return null;
  return {
    kind: "ingest_stale",
    severity: "warning",
    dedupeKey: "ingest_stale",
    message: Number.isFinite(last)
      ? `No llegan datos de Meta hace más de ${INGEST_STALE_HOURS} horas. Revisa la conexión en Configurar cliente y ejecuta la ingesta manual; las demás alertas de campañas quedan en pausa hasta que vuelvan los datos.`
      : "La ingesta de Meta nunca se ha ejecutado para este cliente. Ejecútala desde Configurar cliente para empezar a vigilar las campañas.",
    data: {
      meta_account_id: account.id,
      last_synced_at: account.lastSyncedAt,
      ads_manager_url: adsManagerUrl(account.adAccountId),
    },
  };
}

// ───────────────────────── reglas de campaña ─────────────────────────

interface CampaignContext {
  input: EvaluationInput;
  currency: string;
  thresholds: SpendThresholds | null;
  names: Map<string, string>;
  plansById: Map<string, CampaignPlan>;
}

function campaignData(ctx: CampaignContext, campaignId: string, extra: Record<string, unknown>) {
  return {
    meta_account_id: ctx.input.account.id,
    campaign_id: campaignId,
    campaign_name: ctx.names.get(campaignId) ?? null,
    currency: ctx.currency,
    reference_day: ctx.input.referenceDay,
    ads_manager_url: adsManagerUrl(ctx.input.account.adAccountId, campaignId),
    ...extra,
  };
}

const expectsResults = (plan: CampaignPlan | undefined) =>
  !plan?.objective || !OBJECTIVES_WITHOUT_RESULTS.includes(plan.objective);

function noResultsAdvice(t: CampaignTotals): string {
  if (t.impressions > 0 && t.clicks === 0) {
    return "Nadie hace clic: revisa el creativo y el texto del anuncio.";
  }
  if (t.clicks > 0) {
    return "Hay clics pero nadie escribe: revisa la oferta y el destino (WhatsApp o formulario).";
  }
  return "Revisa el creativo y la oferta; si sigue igual, pausa o cambia la audiencia.";
}

function spendNoResults(ctx: CampaignContext, campaignIds: string[]): AlertCandidate[] {
  const { input, thresholds, currency } = ctx;
  if (!thresholds || input.unattributedMetaLeads > 0) return [];
  const window = dayRange(input.referenceDay, NO_RESULTS_WINDOW_DAYS);
  return campaignIds.flatMap((id) => {
    if (!expectsResults(ctx.plansById.get(id))) return [];
    const t = totals(input.days, id, window, ctx.names.get(id) ?? id);
    if (t.results > 0 || t.spend < thresholds.noResultsWarning) return [];
    const severity: AlertSeverity = t.spend >= thresholds.noResultsCritical ? "critical" : "warning";
    return [
      {
        kind: "spend_no_results",
        severity,
        dedupeKey: `spend_no_results:${id}`,
        message: `«${t.name}» gastó ${formatMoney(t.spend, currency)} en los últimos ${NO_RESULTS_WINDOW_DAYS} días sin ningún mensaje ni lead. ${noResultsAdvice(t)}`,
        data: campaignData(ctx, id, {
          window_from: window[0],
          window_to: window[window.length - 1],
          spend: t.spend,
          impressions: t.impressions,
          clicks: t.clicks,
        }),
      },
    ];
  });
}

function cpaSpike(ctx: CampaignContext, campaignIds: string[]): AlertCandidate[] {
  const { input, thresholds, currency } = ctx;
  if (!thresholds) return [];
  const recent = dayRange(input.referenceDay, CPA_RECENT_DAYS);
  const baseline = dayRange(addDaysIso(recent[0], -1), CPA_BASELINE_DAYS);
  return campaignIds.flatMap((id) => {
    if (!expectsResults(ctx.plansById.get(id))) return [];
    const name = ctx.names.get(id) ?? id;
    const r = totals(input.days, id, recent, name);
    const b = totals(input.days, id, baseline, name);
    if (b.results < CPA_MIN_BASELINE_RESULTS || r.results === 0 || r.spend < thresholds.cpaMinRecentSpend) return [];
    const recentCpa = r.spend / r.results;
    const baseCpa = b.spend / b.results;
    if (baseCpa <= 0) return [];
    const rise = recentCpa / baseCpa - 1;
    if (rise < CPA_RISE_WARNING) return [];
    return [
      {
        kind: "cpa_spike",
        severity: rise >= CPA_RISE_CRITICAL ? "critical" : "warning",
        dedupeKey: `cpa_spike:${id}`,
        message: `El costo por resultado de «${name}» subió ${pct(rise)}: ${formatMoney(recentCpa, currency)} por mensaje/lead en los últimos ${CPA_RECENT_DAYS} días contra ${formatMoney(baseCpa, currency)} de promedio en ${CPA_BASELINE_DAYS} días. Renueva el creativo (puede estar saturado); si no mejora, cambia la audiencia.`,
        data: campaignData(ctx, id, {
          recent_cpa: Math.round(recentCpa * 100) / 100,
          baseline_cpa: Math.round(baseCpa * 100) / 100,
          rise: Math.round(rise * 1000) / 1000,
          recent_results: r.results,
          baseline_results: b.results,
        }),
      },
    ];
  });
}

function isRunning(plan: CampaignPlan, firstDay: string, now: Date): boolean {
  if (plan.status !== "ACTIVE") return false;
  if (plan.startTime && plan.startTime.slice(0, 10) > firstDay) return false;
  return !plan.stopTime || Date.parse(plan.stopTime) > now.getTime();
}

function zeroSpendActive(ctx: CampaignContext): AlertCandidate[] {
  const { input } = ctx;
  const window = dayRange(input.referenceDay, ZERO_SPEND_DAYS);
  const before = dayRange(addDaysIso(window[0], -1), 7);
  return input.campaigns.flatMap((plan) => {
    if (!isRunning(plan, window[0], input.now)) return [];
    const id = plan.fbCampaignId;
    if (totals(input.days, id, window, plan.name).spend > 0) return [];
    const wasSpending = totals(input.days, id, before, plan.name).spend > 0;
    return [
      {
        kind: "zero_spend_active",
        severity: wasSpending ? "critical" : "warning",
        dedupeKey: `zero_spend_active:${id}`,
        message: wasSpending
          ? `«${plan.name}» está activa pero lleva ${ZERO_SPEND_DAYS} días sin gastar. Revisa en Meta el método de pago, el límite de gasto de la cuenta y si algún anuncio fue rechazado.`
          : `«${plan.name}» está activa pero no ha gastado en ${ZERO_SPEND_DAYS} días. Revisa en Meta si los anuncios están en revisión o rechazados y que el método de pago esté al día. Si la pausaste en Meta, sincroniza las campañas.`,
        data: campaignData(ctx, id, { window_from: window[0], window_to: window[window.length - 1] }),
      },
    ];
  });
}

function overspend(ctx: CampaignContext): AlertCandidate[] {
  const { input, thresholds, currency } = ctx;
  if (!thresholds) return [];
  const day = input.referenceDay;
  return input.campaigns.flatMap((plan): AlertCandidate[] => {
    const budget = plan.expectedDailyBudget;
    if (plan.status !== "ACTIVE" || !budget || budget <= 0) return [];
    const id = plan.fbCampaignId;
    const spend = totals(input.days, id, [day], plan.name).spend;
    const ratio = spend / budget;
    const data = campaignData(ctx, id, { day, spend, expected_daily_budget: budget, ratio: Math.round(ratio * 100) / 100 });
    if (ratio >= BUDGET_MISMATCH_RATIO) {
      return [
        {
          kind: "budget_mismatch",
          severity: "warning",
          dedupeKey: `budget_mismatch:${id}`,
          message: `«${plan.name}» gastó ${formatMoney(spend, currency)} el ${shortDay(day)}, ${Math.round(ratio)} veces el presupuesto diario guardado (${formatMoney(budget, currency)}). El presupuesto en Meta no coincide con el de la plataforma: revísalo en el Administrador de anuncios y sincroniza las campañas.`,
          data,
        },
      ];
    }
    if (ratio < OVERSPEND_WARNING_RATIO || spend < thresholds.overspendMinSpend) return [];
    return [
      {
        kind: "overspend",
        severity: ratio >= OVERSPEND_CRITICAL_RATIO ? "critical" : "warning",
        dedupeKey: `overspend:${id}:${day}`,
        message:
          ratio >= OVERSPEND_CRITICAL_RATIO
            ? `«${plan.name}» gastó ${formatMoney(spend, currency)} el ${shortDay(day)}, ${times(ratio)} su presupuesto diario (${formatMoney(budget, currency)}). Es más de lo que Meta permite: revisa si alguien cambió el presupuesto en Meta y corrígelo.`
            : `«${plan.name}» gastó ${formatMoney(spend, currency)} el ${shortDay(day)}, ${times(ratio)} su presupuesto diario (${formatMoney(budget, currency)}). Meta puede gastar hasta un 75 % más algunos días; si se repite, revisa el presupuesto en Meta.`,
        data,
      },
    ];
  });
}

// ───────────────────────── evaluación ─────────────────────────

/** Evalúa todas las reglas para una cuenta de Meta de un cliente. */
export function evaluateCampaignAlerts(input: EvaluationInput): EvaluationResult {
  const candidates: AlertCandidate[] = [];
  const evaluated: AlertKind[] = ["meta_connection"];

  const connection = connectionAlert(input);
  if (connection) candidates.push(connection);

  // Sin cuenta publicitaria no hay ingesta que vigilar ni campañas que evaluar.
  if (!input.account.adAccountId) return { candidates, evaluated };

  evaluated.push("ingest_stale");
  const stale = staleAlert(input);
  if (stale) candidates.push(stale);

  // Con la conexión rota o los datos atrasados, "gasto 0" o "sin resultados"
  // serían falsos: las reglas de campaña se saltan y sus alertas quedan como están.
  if (connection?.severity === "critical" || input.account.lastSyncError || stale) {
    return { candidates, evaluated };
  }

  const currency = (input.account.currency ?? "CLP").toUpperCase();
  const ctx: CampaignContext = {
    input,
    currency,
    thresholds: SPEND_THRESHOLDS[currency] ?? null,
    names: campaignNames(input.days, input.campaigns),
    plansById: new Map(input.campaigns.map((c) => [c.fbCampaignId, c])),
  };
  const campaignIds = [...new Set(input.days.map((d) => d.campaignId))].sort();

  candidates.push(
    ...spendNoResults(ctx, campaignIds),
    ...cpaSpike(ctx, campaignIds),
    ...zeroSpendActive(ctx),
    ...(ENABLE_BUDGET_RULES ? overspend(ctx) : []),
  );
  evaluated.push("zero_spend_active");
  if (ctx.thresholds) evaluated.push("spend_no_results", "cpa_spike");
  // Apagadas: no se evalúan, así que tampoco se auto-resuelven alertas de presupuesto.
  if (ctx.thresholds && ENABLE_BUDGET_RULES) evaluated.push("overspend", "budget_mismatch");
  return { candidates, evaluated };
}
