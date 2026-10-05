/**
 * Alertas automáticas de campañas de Meta Ads.
 *
 * Lee lo que la plataforma ya guardó (ad_insights_daily, meta_ads_campaigns,
 * meta_accounts, atribuciones y leads), evalúa las reglas puras de
 * ./campaignAlerts.rules.ts y sincroniza campaign_alerts:
 *   - crea la alerta si no hay una abierta con la misma dedupe_key,
 *   - actualiza mensaje/severidad si la abierta cambió,
 *   - la auto-resuelve (resolved_at, resolved_by = null) cuando la condición
 *     desaparece, solo para reglas que sí se pudieron evaluar.
 * Nunca llama a Meta ni modifica campañas: es solo lectura.
 *
 * dedupe_key = regla + campaña (+ día para el sobregasto, que es un evento de
 * un día). El cliente ya forma parte del índice único de alertas abiertas
 * (client_id, dedupe_key). Las reglas de estado ("sin resultados", "gasto 0")
 * no llevan el día en la clave: con el día se abriría una alerta nueva cada
 * mañana mientras el problema siga, que es justo lo que se quiere evitar.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import {
  CPA_BASELINE_DAYS,
  CPA_RECENT_DAYS,
  MANUAL_RESOLVE_SNOOZE_DAYS,
  NO_RESULTS_WINDOW_DAYS,
} from "./campaignAlerts.config";
import {
  ALERT_KINDS,
  addDaysIso,
  dayRange,
  evaluateCampaignAlerts,
  type AccountSnapshot,
  type AlertCandidate,
  type CampaignDay,
  type CampaignPlan,
  type EvaluationInput,
  type EvaluationResult,
} from "./campaignAlerts.rules";

const ACTIVE_STATUS = "activo";
const DEFAULT_TIME_ZONE = "America/Santiago";
const PLATFORM = "meta";
/** Lote chico: run_http_cron_job corta la petición a los 15 s. */
export const DEFAULT_BATCH_LIMIT = 8;
/** ~9 consultas por cliente; Workers permite 1000 subrequests por invocación. */
export const MAX_BATCH_LIMIT = 15;
const CLIENT_CONCURRENCY = 3;
const PAGE_SIZE = 1000;
const MAX_INSIGHT_ROWS = 20_000;
const MAX_ATTRIBUTION_ROWS = 10_000;
/** Días de historia que necesitan las reglas (base de CPL + ventana reciente). */
const HISTORY_DAYS = CPA_BASELINE_DAYS + CPA_RECENT_DAYS;
const DAY_MS = 86_400_000;
const UNIQUE_VIOLATION = "23505";

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Fecha local (YYYY-MM-DD) de un instante en la zona de la cuenta. */
export function localDate(instant: Date | string, timeZone: string | null): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || DEFAULT_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Desfase (ms) de la zona respecto de UTC en el instante dado. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second,
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Instante UTC (ISO) de la medianoche local de `date` en la zona de la cuenta. */
export function localMidnightUtc(date: string, timeZone: string | null): string {
  const tz = timeZone || DEFAULT_TIME_ZONE;
  const naive = Date.parse(`${date}T00:00:00Z`);
  try {
    const first = naive - zoneOffsetMs(naive, tz);
    // Segunda pasada por si la medianoche cae en un cambio de horario.
    return new Date(naive - zoneOffsetMs(first, tz)).toISOString();
  } catch {
    return new Date(naive).toISOString();
  }
}

// ───────────────────────── lectura ─────────────────────────

interface AccountRow {
  id: string;
  client_id: string;
  ad_account_id: string | null;
  currency: string | null;
  timezone_name: string | null;
  token_valid: boolean | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
  last_ingest_at: string | null;
  last_sync_error: string | null;
  created_at: string;
}

const ACCOUNT_COLUMNS =
  "id,client_id,ad_account_id,currency,timezone_name,token_valid,token_expires_at,last_synced_at,last_ingest_at,last_sync_error,created_at";

type InsightRow = {
  date: string;
  campaign_id: string | null;
  campaign_name: string | null;
  ad_id: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  messaging_conversations_started: number;
};

function insightsQuery(clientId: string, from: string, to: string) {
  return supabaseAdmin
    .from("ad_insights_daily")
    .select(
      "date,campaign_id,campaign_name,ad_id,spend,impressions,clicks,messaging_conversations_started",
    )
    .eq("client_id", clientId)
    .eq("level", "ad")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
    .order("entity_id", { ascending: true });
}

/**
 * Tras leer `cap` filas, pide UNA más: si existe, los datos quedarían
 * truncados y se lanza error (el cliente cuenta como fallido y no se evalúa ni
 * se auto-resuelve nada con ellos). Justo `cap` filas no es un fallo.
 */
async function assertNotTruncated(
  probe: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  label: string,
  cap: number,
): Promise<void> {
  const { data, error } = await probe;
  if (error) throw new Error(`[alerts] ${label}: ${error.message}`);
  if ((data ?? []).length > 0)
    throw new Error(`[alerts] ${label}: se superó el tope de ${cap} filas`);
}

async function loadInsights(clientId: string, from: string, to: string): Promise<InsightRow[]> {
  const rows: InsightRow[] = [];
  for (let start = 0; start < MAX_INSIGHT_ROWS; start += PAGE_SIZE) {
    const { data, error } = await insightsQuery(clientId, from, to).range(
      start,
      start + PAGE_SIZE - 1,
    );
    if (error) throw new Error(`[alerts] insights: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
  await assertNotTruncated(
    insightsQuery(clientId, from, to).range(MAX_INSIGHT_ROWS, MAX_INSIGHT_ROWS),
    "insights",
    MAX_INSIGHT_ROWS,
  );
  return rows;
}

function attributionsQuery(clientId: string, fromUtc: string) {
  return (
    supabaseAdmin
      .from("attributions")
      .select("ad_id,first_seen_at")
      .eq("client_id", clientId)
      .not("ad_id", "is", null)
      .gte("first_seen_at", fromUtc)
      // Orden estable para que la paginación no salte ni repita filas.
      .order("first_seen_at", { ascending: true })
      .order("id", { ascending: true })
  );
}

/** Conversaciones de WhatsApp atribuidas a un anuncio, por campaña y día local. */
async function loadAttributedResults(
  clientId: string,
  adToCampaign: Map<string, string>,
  fromUtc: string,
  timeZone: string | null,
): Promise<Map<string, number>> {
  const byCampaignDay = new Map<string, number>();
  if (adToCampaign.size === 0) return byCampaignDay;
  for (let start = 0; start < MAX_ATTRIBUTION_ROWS; start += PAGE_SIZE) {
    const { data, error } = await attributionsQuery(clientId, fromUtc).range(
      start,
      start + PAGE_SIZE - 1,
    );
    if (error) throw new Error(`[alerts] atribuciones: ${error.message}`);
    for (const r of data ?? []) {
      const campaignId = r.ad_id ? adToCampaign.get(r.ad_id) : undefined;
      if (!campaignId) continue;
      const key = `${campaignId}|${localDate(r.first_seen_at, timeZone)}`;
      byCampaignDay.set(key, (byCampaignDay.get(key) ?? 0) + 1);
    }
    if (!data || data.length < PAGE_SIZE) return byCampaignDay;
  }
  await assertNotTruncated(
    attributionsQuery(clientId, fromUtc).range(MAX_ATTRIBUTION_ROWS, MAX_ATTRIBUTION_ROWS),
    "atribuciones",
    MAX_ATTRIBUTION_ROWS,
  );
  return byCampaignDay;
}

/** Suma los anuncios por campaña y día, y agrega las conversaciones atribuidas. */
export function toCampaignDays(rows: InsightRow[], attributed: Map<string, number>): CampaignDay[] {
  const byKey = new Map<string, CampaignDay>();
  for (const r of rows) {
    if (!r.campaign_id) continue;
    const key = `${r.campaign_id}|${r.date}`;
    const prev = byKey.get(key) ?? {
      date: r.date,
      campaignId: r.campaign_id,
      campaignName: r.campaign_name,
      spend: 0,
      impressions: 0,
      clicks: 0,
      results: attributed.get(key) ?? 0,
    };
    byKey.set(key, {
      ...prev,
      spend: prev.spend + num(r.spend),
      impressions: prev.impressions + num(r.impressions),
      clicks: prev.clicks + num(r.clicks),
      results: prev.results + num(r.messaging_conversations_started),
    });
  }
  return [...byKey.values()];
}

async function loadCampaignPlans(clientId: string): Promise<CampaignPlan[]> {
  const [campaigns, adsets] = await Promise.all([
    supabaseAdmin
      .from("meta_ads_campaigns")
      .select("id,fb_campaign_id,name,status,objective,daily_budget,start_time,stop_time")
      .eq("client_id", clientId)
      .not("fb_campaign_id", "is", null),
    supabaseAdmin
      .from("meta_ads_adsets")
      .select("campaign_id,daily_budget")
      .eq("client_id", clientId)
      .eq("status", "ACTIVE"),
  ]);
  if (campaigns.error) throw new Error(`[alerts] campañas: ${campaigns.error.message}`);
  if (adsets.error) throw new Error(`[alerts] conjuntos: ${adsets.error.message}`);

  const adsetBudget = new Map<string, number>();
  for (const a of adsets.data ?? []) {
    if (a.daily_budget)
      adsetBudget.set(a.campaign_id, (adsetBudget.get(a.campaign_id) ?? 0) + num(a.daily_budget));
  }
  return (campaigns.data ?? []).flatMap((c) =>
    c.fb_campaign_id
      ? [
          {
            fbCampaignId: c.fb_campaign_id,
            name: c.name,
            status: c.status,
            objective: c.objective,
            expectedDailyBudget: c.daily_budget
              ? num(c.daily_budget)
              : adsetBudget.get(c.id) || null,
            startTime: c.start_time,
            stopTime: c.stop_time,
          },
        ]
      : [],
  );
}

async function countUnattributedMetaLeads(clientId: string, fromUtc: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("client_leads")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("source", "meta_ads")
    .gte("created_at", fromUtc);
  if (error) throw new Error(`[alerts] leads: ${error.message}`);
  return count ?? 0;
}

function toSnapshot(a: AccountRow): AccountSnapshot {
  return {
    id: a.id,
    adAccountId: a.ad_account_id,
    currency: a.currency,
    tokenValid: a.token_valid,
    tokenExpiresAt: a.token_expires_at,
    lastSyncedAt: a.last_synced_at,
    lastIngestAt: a.last_ingest_at,
    lastSyncError: a.last_sync_error,
    createdAt: a.created_at,
  };
}

/** Arma la entrada de las reglas para una cuenta (todo desde la BD, nada de Meta). */
export async function loadEvaluationInput(
  account: AccountRow,
  now: Date,
): Promise<EvaluationInput> {
  const referenceDay = addDaysIso(localDate(now, account.timezone_name), -1);
  const base: EvaluationInput = {
    clientId: account.client_id,
    now,
    referenceDay,
    account: toSnapshot(account),
    days: [],
    campaigns: [],
    unattributedMetaLeads: 0,
  };
  if (!account.ad_account_id) return base;

  const firstDay = dayRange(referenceDay, HISTORY_DAYS)[0];
  const historyFromUtc = localMidnightUtc(firstDay, account.timezone_name);
  const noResultsFrom = dayRange(referenceDay, NO_RESULTS_WINDOW_DAYS)[0];
  const noResultsFromUtc = localMidnightUtc(noResultsFrom, account.timezone_name);

  const [rows, campaigns, unattributedMetaLeads] = await Promise.all([
    loadInsights(account.client_id, firstDay, referenceDay),
    loadCampaignPlans(account.client_id),
    countUnattributedMetaLeads(account.client_id, noResultsFromUtc),
  ]);
  const adToCampaign = new Map<string, string>();
  for (const r of rows) if (r.ad_id && r.campaign_id) adToCampaign.set(r.ad_id, r.campaign_id);
  const attributed = await loadAttributedResults(
    account.client_id,
    adToCampaign,
    historyFromUtc,
    account.timezone_name,
  );

  return { ...base, days: toCampaignDays(rows, attributed), campaigns, unattributedMetaLeads };
}

// ───────────────────────── escritura ─────────────────────────

export interface ReconcileCounts {
  created: number;
  updated: number;
  resolved: number;
  /** Condición vigente pero alguien la resolvió a mano hace poco: no se reabre. */
  snoozed: number;
}

type OpenAlert = {
  id: string;
  dedupe_key: string | null;
  severity: string;
  message: string;
  kind: string;
};

async function loadExistingAlerts(clientId: string, now: Date) {
  const snoozeFrom = new Date(now.getTime() - MANUAL_RESOLVE_SNOOZE_DAYS * DAY_MS).toISOString();
  const [open, snoozed] = await Promise.all([
    supabaseAdmin
      .from("campaign_alerts")
      .select("id,dedupe_key,severity,message,kind")
      .eq("client_id", clientId)
      .eq("platform", PLATFORM)
      .in("kind", [...ALERT_KINDS])
      .is("resolved_at", null),
    supabaseAdmin
      .from("campaign_alerts")
      .select("dedupe_key")
      .eq("client_id", clientId)
      .eq("platform", PLATFORM)
      .in("kind", [...ALERT_KINDS])
      .not("resolved_by", "is", null)
      .gte("resolved_at", snoozeFrom),
  ]);
  if (open.error) throw new Error(`[alerts] abiertas: ${open.error.message}`);
  if (snoozed.error) throw new Error(`[alerts] resueltas: ${snoozed.error.message}`);
  return {
    open: (open.data ?? []) as OpenAlert[],
    snoozedKeys: new Set(
      (snoozed.data ?? []).map((r) => r.dedupe_key).filter((k): k is string => Boolean(k)),
    ),
  };
}

function insertPayload(clientId: string, c: AlertCandidate): TablesInsert<"campaign_alerts"> {
  return {
    client_id: clientId,
    platform: PLATFORM,
    kind: c.kind,
    severity: c.severity,
    message: c.message,
    data: c.data as Json,
    dedupe_key: c.dedupeKey,
  };
}

/**
 * Inserta las alertas nuevas de un cliente en una sola petición. Si otra
 * ejecución abrió alguna entre la lectura y la escritura (índice único de
 * abiertas), reintenta fila por fila e ignora las que ya existen.
 */
async function insertAlerts(rows: Array<TablesInsert<"campaign_alerts">>): Promise<number> {
  const { error } = await supabaseAdmin.from("campaign_alerts").insert(rows);
  if (!error) return rows.length;
  if (error.code !== UNIQUE_VIOLATION) throw new Error(`[alerts] crear: ${error.message}`);
  let created = 0;
  for (const row of rows) {
    const { error: rowErr } = await supabaseAdmin.from("campaign_alerts").insert(row);
    if (rowErr && rowErr.code !== UNIQUE_VIOLATION)
      throw new Error(`[alerts] crear: ${rowErr.message}`);
    if (!rowErr) created++;
  }
  return created;
}

/** Lleva campaign_alerts al estado que dicen las reglas para este cliente. */
export async function reconcileAlerts(
  clientId: string,
  result: EvaluationResult,
  now: Date,
): Promise<ReconcileCounts> {
  const counts: ReconcileCounts = { created: 0, updated: 0, resolved: 0, snoozed: 0 };
  const { open, snoozedKeys } = await loadExistingAlerts(clientId, now);
  const openByKey = new Map(
    open.filter((a) => a.dedupe_key).map((a) => [a.dedupe_key as string, a]),
  );
  const wanted = new Set(result.candidates.map((c) => c.dedupeKey));

  const toUpdate: Array<TablesInsert<"campaign_alerts">> = [];
  const toInsert: Array<TablesInsert<"campaign_alerts">> = [];
  for (const c of result.candidates) {
    const existing = openByKey.get(c.dedupeKey);
    if (existing) {
      if (existing.message !== c.message || existing.severity !== c.severity) {
        toUpdate.push({ ...insertPayload(clientId, c), id: existing.id });
      }
    } else if (snoozedKeys.has(c.dedupeKey)) {
      counts.snoozed++;
    } else {
      toInsert.push(insertPayload(clientId, c));
    }
  }

  // Un solo upsert por id para todas las abiertas que cambiaron de mensaje o severidad.
  if (toUpdate.length > 0) {
    const { error } = await supabaseAdmin
      .from("campaign_alerts")
      .upsert(toUpdate, { onConflict: "id" });
    if (error) throw new Error(`[alerts] actualizar: ${error.message}`);
    counts.updated = toUpdate.length;
  }
  if (toInsert.length > 0) counts.created = await insertAlerts(toInsert);

  const evaluated = new Set<string>(result.evaluated);
  const toResolve = open.filter(
    (a) => evaluated.has(a.kind) && a.dedupe_key && !wanted.has(a.dedupe_key),
  );
  if (toResolve.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("campaign_alerts")
      .update({ resolved_at: now.toISOString(), resolved_by: null })
      .in(
        "id",
        toResolve.map((a) => a.id),
      )
      .is("resolved_at", null)
      .select("id");
    if (error) throw new Error(`[alerts] resolver: ${error.message}`);
    counts.resolved = data?.length ?? 0;
  }
  return counts;
}

// ───────────────────────── lotes ─────────────────────────

export interface AlertsBatchOptions {
  offset?: number;
  limit?: number;
  /** Solo este cliente (debe estar activo y con Meta conectado). */
  clientId?: string;
  now?: Date;
}

export interface AlertsRunSummary {
  offset: number;
  clients: number;
  evaluated: number;
  failed: number;
  created: number;
  updated: number;
  resolved: number;
  snoozed: number;
  /** Alertas vigentes por regla (abiertas o recién creadas) en este lote. */
  by_kind: Record<string, number>;
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

/** Evalúa y sincroniza las alertas de un cliente. */
export async function runAlertsForAccount(account: AccountRow, now: Date) {
  const input = await loadEvaluationInput(account, now);
  const result = evaluateCampaignAlerts(input);
  const counts = await reconcileAlerts(account.client_id, result, now);
  return { result, counts };
}

/**
 * Evalúa un lote de clientes activos con Meta conectado (orden estable por
 * client_id). Devuelve `next_offset` para seguir con el siguiente lote.
 */
export async function runCampaignAlerts(opts: AlertsBatchOptions = {}): Promise<AlertsRunSummary> {
  const now = opts.now ?? new Date();
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.min(MAX_BATCH_LIMIT, Math.max(1, opts.limit ?? DEFAULT_BATCH_LIMIT));

  let q = supabaseAdmin
    .from("meta_accounts")
    .select(`${ACCOUNT_COLUMNS},clients!inner(status)`)
    .eq("connected", true)
    .eq("clients.status", ACTIVE_STATUS);
  if (opts.clientId) q = q.eq("client_id", opts.clientId);
  // Se pide uno extra para saber si quedan más.
  const { data: accounts, error } = await q
    .order("client_id", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw new Error(`[alerts] cuentas: ${error.message}`);

  const batch = (accounts ?? []).slice(0, limit) as unknown as AccountRow[];
  const summary: AlertsRunSummary = {
    offset,
    clients: batch.length,
    evaluated: 0,
    failed: 0,
    created: 0,
    updated: 0,
    resolved: 0,
    snoozed: 0,
    by_kind: {},
    errors: [],
    next_offset: (accounts ?? []).length > limit ? offset + limit : null,
  };

  const outcomes: Array<{
    clientId: string;
    counts?: ReconcileCounts;
    kinds?: string[];
    error?: string;
  }> = [];
  await runPool(batch, CLIENT_CONCURRENCY, async (account) => {
    try {
      const { result, counts } = await runAlertsForAccount(account, now);
      outcomes.push({
        clientId: account.client_id,
        counts,
        kinds: result.candidates.map((c) => c.kind),
      });
    } catch (e) {
      const message = (e as Error).message;
      console.error("[alerts] cliente falló", { clientId: account.client_id, message });
      outcomes.push({ clientId: account.client_id, error: message });
    }
  });

  return outcomes.reduce<AlertsRunSummary>((acc, o) => {
    if (o.error !== undefined) {
      return {
        ...acc,
        failed: acc.failed + 1,
        errors: [...acc.errors, { clientId: o.clientId, message: o.error }],
      };
    }
    const byKind = { ...acc.by_kind };
    for (const k of o.kinds ?? []) byKind[k] = (byKind[k] ?? 0) + 1;
    const c = o.counts as ReconcileCounts;
    return {
      ...acc,
      evaluated: acc.evaluated + 1,
      created: acc.created + c.created,
      updated: acc.updated + c.updated,
      resolved: acc.resolved + c.resolved,
      snoozed: acc.snoozed + c.snoozed,
      by_kind: byKind,
    };
  }, summary);
}
