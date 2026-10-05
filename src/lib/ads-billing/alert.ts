/**
 * Alerta "Pago de pauta" en Inicio (campaign_alerts, kind 'billing_meta').
 * Lógica pura: el servidor la escribe; la UI la lee para armar el mensaje.
 */
import {
  metaBillingHubUrl,
  type MetaBillingEvaluation,
  type MetaBillingReason,
} from "./metaStatus";

export const BILLING_META_KIND = "billing_meta";

export interface BillingAlertCandidate {
  kind: typeof BILLING_META_KIND;
  severity: "critical" | "warning";
  message: string;
  dedupeKey: string;
  data: {
    reason: MetaBillingReason;
    ad_account_id: string;
    client_name: string;
    billing_url: string;
  };
}

export function billingAlertDedupeKey(adAccountId: string): string {
  return `${BILLING_META_KIND}:${adAccountId}`;
}

/** null si la cuenta no tiene un problema que merezca alerta. */
export function metaBillingAlertCandidate(
  clientName: string,
  adAccountId: string,
  evaluation: MetaBillingEvaluation,
): BillingAlertCandidate | null {
  if (!evaluation.alert) return null;
  return {
    kind: BILLING_META_KIND,
    severity: evaluation.alert,
    message: `Pago de pauta: revisar Meta Ads de ${clientName} (${evaluation.label.toLowerCase()}).`,
    dedupeKey: billingAlertDedupeKey(adAccountId),
    data: {
      reason: evaluation.reason,
      ad_account_id: adAccountId,
      client_name: clientName,
      billing_url: metaBillingHubUrl(adAccountId),
    },
  };
}

/** Lee data de una alerta billing_meta guardada (tolerante a datos raros). */
export function parseBillingAlertData(data: unknown): {
  reason: MetaBillingReason;
  adAccountId: string | null;
  clientName: string | null;
  billingUrl: string;
} {
  const d =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const adAccountId = typeof d.ad_account_id === "string" ? d.ad_account_id : null;
  const reasons: MetaBillingReason[] = ["unsettled", "disabled", "no_funding"];
  const reason = reasons.find((r) => r === d.reason) ?? "no_funding";
  return {
    reason,
    adAccountId,
    clientName: typeof d.client_name === "string" ? d.client_name : null,
    // Siempre se reconstruye: nunca se abre un link guardado sin validar.
    billingUrl: metaBillingHubUrl(adAccountId),
  };
}

/**
 * Alertas billing_meta abiertas que ya no corresponden a la cuenta publicitaria
 * actual del cliente (cambió de cuenta, se desconectó o se borró): se cierran.
 * `currentByClient`: client_id → id de la cuenta conectada (solo dígitos) o null.
 */
export function staleBillingAlertIds(
  open: ReadonlyArray<{ id: string; client_id: string; dedupe_key: string | null }>,
  currentByClient: ReadonlyMap<string, string | null>,
): string[] {
  return open
    .filter((a) => {
      const current = currentByClient.get(a.client_id) ?? null;
      return !current || a.dedupe_key !== billingAlertDedupeKey(current);
    })
    .map((a) => a.id);
}
