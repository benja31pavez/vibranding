// Ingesta diaria de métricas por campaña → google_ads_insights_daily (upsert idempotente).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addDaysYmd, chileToday } from "@/lib/dates/chile";
import { requireGoogleAdsConfig, type GoogleAdsConfig } from "@/lib/google-ads/config.server";
import { GoogleAdsError, searchStream } from "@/lib/google-ads/client.server";
import {
  CUSTOMER_CURRENCY_QUERY,
  buildCampaignDailyQuery,
  flattenSearchStream,
  parseCampaignDailyRows,
} from "@/lib/google-ads/gaql";
import {
  GOOGLE_ADS_ACCOUNT_COLUMNS,
  markSyncResult,
  type GoogleAdsAccountRow,
} from "@/lib/google-ads/connection.server";
import {
  getAccessForAccount,
  newAccessCache,
  type AccessCache,
} from "@/lib/google-ads/agency.server";

/** El cron re-descarga los últimos 3 días: Google ajusta conversiones con retraso. */
export const INGEST_WINDOW_DAYS = 3;
/** Al vincular una cuenta se trae el último mes para que la tabla no parta vacía. */
export const BACKFILL_DAYS = 30;
export const DEFAULT_BATCH_LIMIT = 8;
export const MAX_BATCH_LIMIT = 8;
const CONCURRENCY = 3;

export type IngestAccountResult = {
  accountId: string;
  clientId: string;
  customerId: string;
  from: string;
  to: string;
  rows: number;
  error?: string;
};

/** Ventana [from, to] en fechas de Chile que termina ayer. */
export function ingestWindow(days: number, now: Date = new Date()): { from: string; to: string } {
  const to = addDaysYmd(chileToday(now), -1);
  return { from: addDaysYmd(to, -(Math.max(1, days) - 1)), to };
}

async function assertClpAccount(
  cfg: GoogleAdsConfig,
  accessToken: string,
  customerId: string,
  loginCustomerId: string | null,
) {
  const body = await searchStream(
    cfg,
    accessToken,
    customerId,
    CUSTOMER_CURRENCY_QUERY,
    loginCustomerId,
  );
  const currency = flattenSearchStream(body)[0]?.customer?.currencyCode ?? null;
  // Falla cerrado: sin moneda confirmada no se guarda nada en cost_clp.
  if (!currency) {
    throw new GoogleAdsError(
      "Google Ads no informó la moneda de la cuenta; no se guardaron métricas.",
      502,
    );
  }
  if (currency !== "CLP") {
    throw new GoogleAdsError(
      `La cuenta factura en ${currency}. La plataforma trabaja solo en pesos chilenos (CLP).`,
      400,
    );
  }
}

/** Descarga y guarda las métricas de una cuenta. Nunca lanza: devuelve el error. */
export async function ingestAccount(
  account: GoogleAdsAccountRow,
  days: number = INGEST_WINDOW_DAYS,
  cfg: GoogleAdsConfig = requireGoogleAdsConfig(),
  cache: AccessCache = newAccessCache(),
): Promise<IngestAccountResult> {
  const { from, to } = ingestWindow(days);
  const base = {
    accountId: account.id,
    clientId: account.client_id,
    customerId: account.customer_id,
    from,
    to,
  };
  try {
    // Token propio del cliente o el de la MCC de la agencia (login-customer-id = MCC).
    const { accessToken, loginCustomerId } = await getAccessForAccount(cfg, account, cache);
    await assertClpAccount(cfg, accessToken, account.customer_id, loginCustomerId);

    const body = await searchStream(
      cfg,
      accessToken,
      account.customer_id,
      buildCampaignDailyQuery(from, to),
      loginCustomerId,
    );
    const rows = parseCampaignDailyRows(body).map((r) => ({
      ...r,
      client_id: account.client_id,
      customer_id: account.customer_id,
    }));

    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from("google_ads_insights_daily")
        .upsert(rows, { onConflict: "client_id,campaign_id,date" });
      if (error) throw new Error(`No se pudieron guardar las métricas: ${error.message}`);
    }
    await markSyncResult(account.id, { ok: true });
    return { ...base, rows: rows.length };
  } catch (e) {
    const err = e as Error;
    const needsReconnect = e instanceof GoogleAdsError && e.needsReconnect;
    console.error("[google-ads ingest] cuenta falló", {
      accountId: account.id,
      message: err.message,
    });
    await markSyncResult(account.id, { ok: false, message: err.message, needsReconnect });
    return { ...base, rows: 0, error: err.message };
  }
}

export async function runPool<T>(
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

export type IngestBatchSummary = {
  accounts: number;
  succeeded: number;
  failed: number;
  rowsWritten: number;
  next_offset: number | null;
  results: IngestAccountResult[];
};

/** Un lote de cuentas conectadas (orden estable por id) con next_offset si quedan más. */
export async function runIngestBatch(opts: {
  offset: number;
  limit: number;
}): Promise<IngestBatchSummary> {
  const cfg = requireGoogleAdsConfig();
  const limit = Math.min(MAX_BATCH_LIMIT, Math.max(1, opts.limit));
  const offset = Math.max(0, opts.offset);

  const { data, error } = await supabaseAdmin
    .from("google_ads_accounts")
    .select(GOOGLE_ADS_ACCOUNT_COLUMNS)
    .eq("status", "conectada")
    // Token propio guardado, o cuenta leída con la MCC de la agencia.
    .or("token_secret_id.not.is.null,auth_source.eq.agencia")
    .order("id", { ascending: true })
    // Se pide uno extra para saber si queda otro lote.
    .range(offset, offset + limit);
  if (error) throw new Error(`No se pudieron listar las cuentas: ${error.message}`);

  const all = (data ?? []) as GoogleAdsAccountRow[];
  const batch = all.slice(0, limit);
  const results: IngestAccountResult[] = [];
  const cache = newAccessCache();
  await runPool(batch, CONCURRENCY, async (account) => {
    results.push(await ingestAccount(account, INGEST_WINDOW_DAYS, cfg, cache));
  });

  const failed = results.filter((r) => r.error).length;
  return {
    accounts: results.length,
    succeeded: results.length - failed,
    failed,
    rowsWritten: results.reduce((acc, r) => acc + r.rows, 0),
    next_offset: all.length > limit ? offset + limit : null,
    results,
  };
}
