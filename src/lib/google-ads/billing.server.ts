// Chequeo diario de facturación de Google Ads (service role) + gate de campañas.
// Solo lectura en Google: nunca crea, activa ni pausa campañas.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { requireGoogleAdsConfig, type GoogleAdsConfig } from "@/lib/google-ads/config.server";
import { GoogleAdsError, searchStream } from "@/lib/google-ads/client.server";
import {
  GOOGLE_ADS_ACCOUNT_COLUMNS,
  type GoogleAdsAccountRow,
} from "@/lib/google-ads/connection.server";
import {
  getAccessForAccount,
  newAccessCache,
  type AccessCache,
} from "@/lib/google-ads/agency.server";
import { runPool } from "@/lib/google-ads/ingest.server";
import {
  ACCOUNT_BUDGET_QUERY,
  BILLING_ALERT_KIND,
  BILLING_CUSTOMER_QUERY,
  BILLING_SETUP_QUERY,
  GOOGLE_ADS_BILLING_URL,
  billingAlert,
  billingGateError,
  evaluateBilling,
  parseAccountBudget,
  parseBillingSetups,
  parseCustomerInfo,
  type BillingAlertDraft,
  type BillingVerdict,
} from "@/lib/google-ads/billing";
import { MANUAL_RESOLVE_SNOOZE_DAYS } from "@/lib/alerts/campaignAlerts.config";

export const DEFAULT_BILLING_BATCH_LIMIT = 8;
export const MAX_BILLING_BATCH_LIMIT = 8;
const CONCURRENCY = 3;
const DAY_MS = 86_400_000;
const UNIQUE_VIOLATION = "23505";
const PLATFORM = "google";

export type BillingCheckResult = {
  clientId: string;
  customerId: string;
  verdict: BillingVerdict | null;
  alert: "abierta" | "resuelta" | "sin_cambios";
  error?: string;
};

// ───────────────────────── alertas ─────────────────────────

/** Abre/actualiza o resuelve la alerta 'billing_google' del cliente. */
export async function syncBillingAlert(
  clientId: string,
  draft: BillingAlertDraft | null,
  data: Record<string, Json>,
  now: Date = new Date(),
): Promise<BillingCheckResult["alert"]> {
  const { data: open, error } = await supabaseAdmin
    .from("campaign_alerts")
    .select("id,severity,message")
    .eq("client_id", clientId)
    .eq("dedupe_key", BILLING_ALERT_KIND)
    .is("resolved_at", null)
    .maybeSingle();
  if (error) throw new Error(`[billing] alerta abierta: ${error.message}`);

  if (!draft) {
    if (!open) return "sin_cambios";
    const { error: rErr } = await supabaseAdmin
      .from("campaign_alerts")
      .update({ resolved_at: now.toISOString(), resolved_by: null })
      .eq("id", open.id);
    if (rErr) throw new Error(`[billing] resolver alerta: ${rErr.message}`);
    return "resuelta";
  }

  if (open) {
    if (open.message === draft.message && open.severity === draft.severity) return "sin_cambios";
    const { error: uErr } = await supabaseAdmin
      .from("campaign_alerts")
      .update({ message: draft.message, severity: draft.severity, data: data as Json })
      .eq("id", open.id);
    if (uErr) throw new Error(`[billing] actualizar alerta: ${uErr.message}`);
    return "abierta";
  }

  // Si el dueño la marcó resuelta a mano hace poco, no se reabre todavía.
  const snoozeFrom = new Date(now.getTime() - MANUAL_RESOLVE_SNOOZE_DAYS * DAY_MS).toISOString();
  const { count, error: sErr } = await supabaseAdmin
    .from("campaign_alerts")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("dedupe_key", BILLING_ALERT_KIND)
    .not("resolved_by", "is", null)
    .gte("resolved_at", snoozeFrom);
  if (sErr) throw new Error(`[billing] alertas resueltas: ${sErr.message}`);
  if ((count ?? 0) > 0) return "sin_cambios";

  const { error: iErr } = await supabaseAdmin.from("campaign_alerts").insert({
    client_id: clientId,
    platform: PLATFORM,
    kind: draft.kind,
    severity: draft.severity,
    message: draft.message,
    data: data as Json,
    dedupe_key: draft.dedupeKey,
  });
  if (iErr && iErr.code !== UNIQUE_VIOLATION) {
    throw new Error(`[billing] crear alerta: ${iErr.message}`);
  }
  return "abierta";
}

// ───────────────────────── estado ─────────────────────────

/** Al desvincular la cuenta: estado "Sin cuenta" y alerta resuelta. */
export async function clearBillingStatus(clientId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("google_ads_billing_status").upsert(
    {
      client_id: clientId,
      customer_id: null,
      checked_at: new Date().toISOString(),
      customer_status: null,
      billing_status: null,
      has_valid_billing: false,
      verdict: "sin_cuenta",
      payments_account_name: null,
      budget_limit_clp: null,
      budget_served_clp: null,
      budget_end_at: null,
      detail: "El cliente no tiene una cuenta de Google Ads vinculada.",
      check_error: null,
    },
    { onConflict: "client_id" },
  );
  if (error) console.error("[billing] no se pudo limpiar el estado", error.message);
  await syncBillingAlert(clientId, null, {}).catch((e: Error) =>
    console.error("[billing] no se pudo resolver la alerta", e.message),
  );
}

/** Guarda el error del chequeo sin borrar el último resultado bueno (el gate lo vence a las 72 h). */
async function recordCheckError(account: GoogleAdsAccountRow, message: string): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("google_ads_billing_status")
    .update({
      checked_at: now,
      check_error: message.slice(0, 500),
      customer_id: account.customer_id,
    })
    .eq("client_id", account.client_id)
    .select("client_id");
  if (error) {
    console.error("[billing] no se pudo guardar el error", error.message);
    return;
  }
  if ((data ?? []).length > 0) return;
  const { error: iErr } = await supabaseAdmin.from("google_ads_billing_status").insert({
    client_id: account.client_id,
    customer_id: account.customer_id,
    checked_at: now,
    has_valid_billing: false,
    verdict: "pendiente",
    detail: "Aún no se pudo revisar la facturación en Google Ads.",
    check_error: message.slice(0, 500),
  });
  if (iErr && iErr.code !== UNIQUE_VIOLATION) {
    console.error("[billing] no se pudo crear el estado", iErr.message);
  }
}

type AccountWithClient = GoogleAdsAccountRow & { clients: { name: string | null } | null };

/** Revisa una cuenta. Nunca lanza: devuelve el error. */
export async function checkAccountBilling(
  account: AccountWithClient,
  cfg: GoogleAdsConfig = requireGoogleAdsConfig(),
  cache: AccessCache = newAccessCache(),
): Promise<BillingCheckResult> {
  const base = { clientId: account.client_id, customerId: account.customer_id };
  try {
    const { accessToken, loginCustomerId } = await getAccessForAccount(cfg, account, cache);
    const query = (q: string) =>
      searchStream(cfg, accessToken, account.customer_id, q, loginCustomerId);
    const [customerBody, setupBody] = await Promise.all([
      query(BILLING_CUSTOMER_QUERY),
      query(BILLING_SETUP_QUERY),
    ]);
    const customer = parseCustomerInfo(customerBody);
    const setups = parseBillingSetups(setupBody);
    // account_budget es opcional (cuentas con pagos automáticos suelen no tenerlo).
    const budget = await query(ACCOUNT_BUDGET_QUERY)
      .then((body) => parseAccountBudget(body, customer.currency))
      .catch((e: Error) => {
        console.warn("[billing] account_budget no disponible", {
          clientId: account.client_id,
          message: e.message,
        });
        return null;
      });

    const evaluation = evaluateBilling({ linked: true, customerStatus: customer.status, setups });
    const now = new Date().toISOString();
    const approved = setups.find((s) => s.status === "APPROVED");
    const { error } = await supabaseAdmin.from("google_ads_billing_status").upsert(
      {
        client_id: account.client_id,
        customer_id: account.customer_id,
        checked_at: now,
        last_success_at: now,
        customer_status: customer.status,
        billing_status: evaluation.billingStatus,
        has_valid_billing: evaluation.hasValidBilling,
        verdict: evaluation.verdict,
        payments_account_name: (approved ?? setups[0])?.paymentsAccountName ?? null,
        budget_limit_clp: budget?.limitClp ?? null,
        budget_served_clp: budget?.servedClp ?? null,
        budget_end_at: budget?.endAt ?? null,
        detail: evaluation.detail,
        check_error: null,
      },
      { onConflict: "client_id" },
    );
    if (error) throw new Error(`No se pudo guardar el estado de facturación: ${error.message}`);

    const alert = await syncBillingAlert(
      account.client_id,
      billingAlert(evaluation, account.clients?.name ?? ""),
      {
        verdict: evaluation.verdict,
        customer_status: customer.status,
        billing_status: evaluation.billingStatus,
        detail: evaluation.detail,
        google_ads_billing_url: GOOGLE_ADS_BILLING_URL,
      },
    );
    return { ...base, verdict: evaluation.verdict, alert };
  } catch (e) {
    const message = (e as Error).message;
    console.error("[billing] cuenta falló", {
      clientId: account.client_id,
      message,
      reconnect: e instanceof GoogleAdsError && e.needsReconnect,
    });
    await recordCheckError(account, message);
    return { ...base, verdict: null, alert: "sin_cambios", error: message };
  }
}

export type BillingBatchSummary = {
  accounts: number;
  succeeded: number;
  failed: number;
  alertsOpen: number;
  next_offset: number | null;
  results: BillingCheckResult[];
};

/** Un lote de cuentas conectadas (orden estable por id) con next_offset si quedan más. */
export async function runBillingBatch(opts: {
  offset: number;
  limit: number;
}): Promise<BillingBatchSummary> {
  const cfg = requireGoogleAdsConfig();
  const limit = Math.min(MAX_BILLING_BATCH_LIMIT, Math.max(1, opts.limit));
  const offset = Math.max(0, opts.offset);
  const { data, error } = await supabaseAdmin
    .from("google_ads_accounts")
    .select(`${GOOGLE_ADS_ACCOUNT_COLUMNS},clients(name)`)
    .eq("status", "conectada")
    .or("token_secret_id.not.is.null,auth_source.eq.agencia")
    .order("id", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw new Error(`No se pudieron listar las cuentas: ${error.message}`);

  const all = (data ?? []) as unknown as AccountWithClient[];
  const batch = all.slice(0, limit);
  const cache = newAccessCache();
  const results: BillingCheckResult[] = [];
  await runPool(batch, CONCURRENCY, async (account) => {
    results.push(await checkAccountBilling(account, cfg, cache));
  });
  const failed = results.filter((r) => r.error).length;
  return {
    accounts: results.length,
    succeeded: results.length - failed,
    failed,
    alertsOpen: results.filter((r) => r.alert === "abierta").length,
    next_offset: all.length > limit ? offset + limit : null,
    results,
  };
}

// ───────────────────────── gate ─────────────────────────

/**
 * Lanza si el cliente no tiene un medio de pago verificado en Google Ads.
 * Usar en TODA acción que cree, active o lance campañas de Google desde la
 * plataforma (hoy no existe ninguna: la integración es solo lectura).
 */
export async function assertBillingVerified(clientId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("google_ads_billing_status")
    .select("has_valid_billing,last_success_at")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error("No se pudo revisar la facturación de Google Ads del cliente");
  const message = billingGateError(data ?? null);
  if (message) throw new Error(message);
}

/** Chequeo inmediato al vincular una cuenta (para que el chip no espere al cron). */
export async function checkClientBillingNow(
  account: GoogleAdsAccountRow,
  cfg: GoogleAdsConfig = requireGoogleAdsConfig(),
): Promise<BillingCheckResult> {
  const { data } = await supabaseAdmin
    .from("clients")
    .select("name")
    .eq("id", account.client_id)
    .maybeSingle();
  return checkAccountBilling({ ...account, clients: { name: data?.name ?? null } }, cfg);
}
