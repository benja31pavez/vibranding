/**
 * Pago de pauta en Meta (solo servidor).
 *
 * El cliente paga la publicidad con su tarjeta en su cuenta publicitaria; aquí
 * solo se consulta GET /act_{id}?fields=account_status,disable_reason,
 * funding_source_details,spend_cap,amount_spent,currency, se guarda el
 * resultado en meta_billing_status y se abre/cierra la alerta 'billing_meta'.
 * Nunca se guarda el detalle de la tarjeta (solo si existe un medio de pago).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { graphUrl } from "@/lib/meta/version";
import { getMetaToken } from "@/lib/meta/tokens.server";
import { MANUAL_RESOLVE_SNOOZE_DAYS } from "@/lib/alerts/campaignAlerts.config";
import { splitBatch, withDeadline } from "@/lib/cron/batch";
import {
  BILLING_META_KIND,
  billingAlertDedupeKey,
  metaBillingAlertCandidate,
} from "@/lib/ads-billing/alert";
import {
  evaluateMetaBilling,
  hasFundingSource,
  metaActivationBlockedMessage,
  normalizeAdAccountId,
  toAmount,
  type MetaBillingEvaluation,
} from "@/lib/ads-billing/metaStatus";

const FIELDS =
  "account_status,disable_reason,funding_source_details,spend_cap,amount_spent,currency";
const FIELDS_NO_FUNDING = "account_status,disable_reason,spend_cap,amount_spent,currency";
const GRAPH_TIMEOUT_MS = 8_000;
/** Códigos de permiso de Graph: se reintenta sin funding_source_details. */
const PERMISSION_CODES = new Set([10, 200, 294]);
const UNIQUE_VIOLATION = "23505";
const DAY_MS = 86_400_000;
/** Una consulta a Graph + 3 a la BD por cuenta: 10 caben holgadas en 12 s. */
export const BILLING_MAX_BATCH_LIMIT = 10;

export interface MetaBillingSnapshot {
  account_status: number | null;
  disable_reason: number | null;
  has_funding: boolean | null;
  spend_cap: number | null;
  amount_spent: number | null;
  currency: string | null;
}

class GraphError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
  ) {
    super(message);
  }
}

async function graphGet(adAccountId: string, fields: string, token: string) {
  const url = `${graphUrl(`act_${adAccountId}`)}?fields=${fields}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body || body.error) {
    const err = (body?.error ?? {}) as {
      error_user_msg?: string;
      message?: string;
      code?: unknown;
    };
    throw new GraphError(
      err.error_user_msg ?? err.message ?? `Meta respondió ${res.status}`,
      typeof err.code === "number" ? err.code : null,
    );
  }
  return body;
}

/** Consulta el estado de pago de una cuenta publicitaria (id solo dígitos). */
export async function fetchMetaBillingSnapshot(
  adAccountId: string,
  token: string,
): Promise<MetaBillingSnapshot> {
  let body: Record<string, unknown>;
  let fundingKnown = true;
  try {
    body = await graphGet(adAccountId, FIELDS, token);
  } catch (e) {
    if (!(e instanceof GraphError) || !PERMISSION_CODES.has(e.code ?? -1)) throw e;
    // Sin permiso para ver el medio de pago: el resto sí sirve, pero no verifica.
    body = await graphGet(adAccountId, FIELDS_NO_FUNDING, token);
    fundingKnown = false;
  }
  const status = toAmount(body.account_status);
  return {
    account_status: status === null ? null : Math.trunc(status),
    disable_reason: toAmount(body.disable_reason),
    has_funding: fundingKnown ? hasFundingSource(body.funding_source_details) : null,
    spend_cap: toAmount(body.spend_cap),
    amount_spent: toAmount(body.amount_spent),
    currency: typeof body.currency === "string" ? body.currency : null,
  };
}

/** Guarda el último chequeo de la cuenta (una fila por cliente + cuenta). */
export async function saveMetaBillingStatus(
  clientId: string,
  adAccountId: string,
  snapshot: MetaBillingSnapshot,
  evaluation: MetaBillingEvaluation,
): Promise<void> {
  const { error } = await (supabaseAdmin.from("meta_billing_status" as any) as any).upsert(
    {
      client_id: clientId,
      ad_account_id: adAccountId,
      checked_at: new Date().toISOString(),
      ...snapshot,
      detail: { reason: evaluation.reason, label: evaluation.label },
    },
    { onConflict: "client_id,ad_account_id" },
  );
  if (error) throw new Error(`[meta billing] guardar estado: ${error.message}`);
}

// ------------------------------------------------------------------ alerta en Inicio

async function openBillingAlert(clientId: string, dedupeKey: string) {
  const { data, error } = await supabaseAdmin
    .from("campaign_alerts")
    .select("id,severity,message")
    .eq("client_id", clientId)
    .eq("kind", BILLING_META_KIND)
    .eq("dedupe_key", dedupeKey)
    .is("resolved_at", null)
    .maybeSingle();
  if (error) throw new Error(`[meta billing] leer alerta: ${error.message}`);
  return data;
}

async function recentlyResolvedByHand(clientId: string, dedupeKey: string, now: Date) {
  const since = new Date(now.getTime() - MANUAL_RESOLVE_SNOOZE_DAYS * DAY_MS).toISOString();
  const { count, error } = await supabaseAdmin
    .from("campaign_alerts")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("kind", BILLING_META_KIND)
    .eq("dedupe_key", dedupeKey)
    .not("resolved_by", "is", null)
    .gte("resolved_at", since);
  if (error) throw new Error(`[meta billing] leer resueltas: ${error.message}`);
  return (count ?? 0) > 0;
}

export type AlertChange = "created" | "updated" | "resolved" | "snoozed" | "none";

/** Abre, actualiza o cierra la alerta 'billing_meta' de la cuenta. */
export async function reconcileBillingAlert(
  clientId: string,
  clientName: string,
  adAccountId: string,
  evaluation: MetaBillingEvaluation,
  now = new Date(),
): Promise<AlertChange> {
  const dedupeKey = billingAlertDedupeKey(adAccountId);
  const candidate = metaBillingAlertCandidate(clientName, adAccountId, evaluation);
  const open = await openBillingAlert(clientId, dedupeKey);

  if (!candidate) {
    if (!open) return "none";
    const { error } = await supabaseAdmin
      .from("campaign_alerts")
      .update({ resolved_at: now.toISOString(), resolved_by: null })
      .eq("id", open.id)
      .is("resolved_at", null);
    if (error) throw new Error(`[meta billing] resolver alerta: ${error.message}`);
    return "resolved";
  }

  const row = {
    client_id: clientId,
    platform: "meta",
    kind: candidate.kind,
    severity: candidate.severity,
    message: candidate.message,
    data: candidate.data,
    dedupe_key: candidate.dedupeKey,
  };
  if (open) {
    if (open.message === row.message && open.severity === row.severity) return "none";
    const { error } = await supabaseAdmin.from("campaign_alerts").update(row).eq("id", open.id);
    if (error) throw new Error(`[meta billing] actualizar alerta: ${error.message}`);
    return "updated";
  }
  if (await recentlyResolvedByHand(clientId, dedupeKey, now)) return "snoozed";
  const { error } = await supabaseAdmin.from("campaign_alerts").insert(row);
  // Otra ejecución la abrió entre la lectura y la escritura: ya existe.
  if (error && error.code !== UNIQUE_VIOLATION)
    throw new Error(`[meta billing] crear alerta: ${error.message}`);
  return error ? "none" : "created";
}

// ------------------------------------------------------------------ bloqueo al activar

export type ActivationCheck = { ok: true } | { ok: false; message: string };

/**
 * Verifica en vivo (no con el chequeo de la mañana) que la cuenta tenga medio
 * de pago y esté activa antes de activar una campaña. Guarda el resultado si
 * puede; si la tabla aún no existe, el bloqueo funciona igual.
 */
export async function verifyMetaBillingForActivation(opts: {
  clientId: string;
  adAccountId: string | null;
  token: string;
}): Promise<ActivationCheck> {
  const id = normalizeAdAccountId(opts.adAccountId);
  if (!id) return { ok: false, message: "Configura la cuenta publicitaria de Meta del cliente." };
  let snapshot: MetaBillingSnapshot;
  try {
    snapshot = await fetchMetaBillingSnapshot(id, opts.token);
  } catch (e) {
    console.error("[meta billing] verificación al activar falló", (e as Error).message);
    return {
      ok: false,
      message:
        "No se puede activar: no pudimos verificar el pago de pauta en Meta. Intenta de nuevo en unos minutos o guarda la campaña en pausa.",
    };
  }
  const evaluation = evaluateMetaBilling(snapshot);
  await saveMetaBillingStatus(opts.clientId, id, snapshot, evaluation).catch((e) =>
    console.warn("[meta billing] no se guardó el estado", (e as Error).message),
  );
  return evaluation.verified
    ? { ok: true }
    : { ok: false, message: metaActivationBlockedMessage(evaluation.reason) };
}

// ------------------------------------------------------------------ chequeo diario por lotes

type AccountRow = { id: string; client_id: string; ad_account_id: string | null };

export type BillingOutcome =
  | { accountId: string; clientId: string; reason: string; alert: AlertChange; error?: undefined }
  | { accountId: string; clientId?: string; error: string };

export interface BillingBatchSummary {
  offset: number;
  accounts: number;
  succeeded: number;
  failed: number;
  problems: number;
  next_offset: number | null;
  results: BillingOutcome[];
}

export const BILLING_PENDING_ERROR = "pendiente: no terminó antes del límite de tiempo del cron";

async function checkOne(account: AccountRow, clientName: string): Promise<BillingOutcome> {
  try {
    const id = normalizeAdAccountId(account.ad_account_id);
    if (!id) return { accountId: account.id, error: "ad_account_id inválido" };
    const token = await getMetaToken(account.id);
    if (!token) return { accountId: account.id, error: "sin token en el vault" };
    const snapshot = await fetchMetaBillingSnapshot(id, token);
    const evaluation = evaluateMetaBilling(snapshot);
    await saveMetaBillingStatus(account.client_id, id, snapshot, evaluation);
    const alert = await reconcileBillingAlert(account.client_id, clientName, id, evaluation);
    return { accountId: account.id, clientId: account.client_id, reason: evaluation.reason, alert };
  } catch (e) {
    const message = (e as Error)?.message ?? "Error inesperado";
    console.error("[meta billing] cuenta falló", { accountId: account.id, message });
    return { accountId: account.id, clientId: account.client_id, error: message };
  }
}

async function clientNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabaseAdmin.from("clients").select("id,name").in("id", ids);
  if (error) throw new Error(`No se pudieron leer los clientes: ${error.message}`);
  return new Map((data ?? []).map((c) => [c.id, c.name ?? "el cliente"]));
}

/** Cuentas de Meta conectadas con cuenta publicitaria, en orden estable por id. */
export async function runMetaBillingBatch(opts: {
  offset: number;
  limit: number;
  deadlineMs: number;
}): Promise<BillingBatchSummary> {
  const limit = Math.min(BILLING_MAX_BATCH_LIMIT, Math.max(1, opts.limit));
  const offset = Math.max(0, opts.offset);
  const { data, error } = await (supabaseAdmin.from("meta_accounts" as any) as any)
    .select("id,client_id,ad_account_id")
    .eq("connected", true)
    .not("ad_account_id", "is", null)
    .order("id", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw new Error(`No se pudieron listar las cuentas: ${error.message}`);

  const { batch, nextOffset } = splitBatch((data ?? []) as AccountRow[], offset, limit);
  const names = await clientNames([...new Set(batch.map((a) => a.client_id))]);
  const results = await Promise.all(
    batch.map((account) =>
      withDeadline<BillingOutcome>(
        checkOne(account, names.get(account.client_id) ?? "el cliente"),
        opts.deadlineMs,
        () => ({
          accountId: account.id,
          clientId: account.client_id,
          error: BILLING_PENDING_ERROR,
        }),
      ),
    ),
  );
  const failed = results.filter((r) => r.error).length;
  const problems = results.filter((r) => "reason" in r && r.reason !== "ok").length;
  return {
    offset,
    accounts: results.length,
    succeeded: results.length - failed,
    failed,
    problems,
    next_offset: nextOffset,
    results,
  };
}
