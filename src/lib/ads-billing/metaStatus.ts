/**
 * Estado de pago de una cuenta publicitaria de Meta (lógica pura, sin I/O).
 *
 * El cliente paga la pauta con SU tarjeta en SU cuenta publicitaria: aquí solo
 * se interpreta lo que responde GET /act_{id}?fields=account_status,
 * disable_reason,funding_source_details,spend_cap,amount_spent,currency.
 * Se usa en el chequeo diario (meta_billing_status), en el bloqueo al activar
 * campañas y en la ficha del cliente.
 */

/** account_status de la Marketing API. */
export const META_ACCOUNT_STATUS = {
  ACTIVE: 1,
  DISABLED: 2,
  UNSETTLED: 3,
  PENDING_RISK_REVIEW: 7,
  PENDING_SETTLEMENT: 8,
  IN_GRACE_PERIOD: 9,
  PENDING_CLOSURE: 100,
  CLOSED: 101,
} as const;

export type MetaBillingReason =
  | "ok"
  | "disabled"
  | "unsettled"
  | "pending_review"
  | "pending_settlement"
  | "grace_period"
  | "closed"
  | "no_funding"
  | "funding_unknown"
  | "unknown_status";

export interface MetaBillingInput {
  account_status: number | null;
  disable_reason?: number | null;
  /** true/false si se pudo leer funding_source_details; null si Meta no lo entregó (permiso). */
  has_funding: boolean | null;
}

export interface MetaBillingEvaluation {
  reason: MetaBillingReason;
  /** Se puede activar campañas: cuenta activa y con medio de pago. */
  verified: boolean;
  /** Problema que merece alerta en Inicio (impago, deshabilitada o sin tarjeta). */
  alert: "critical" | "warning" | null;
  /** Texto corto en español para la ficha y los mensajes. */
  label: string;
}

const LABELS: Readonly<Record<MetaBillingReason, string>> = {
  ok: "Cuenta activa con medio de pago",
  disabled: "Cuenta publicitaria deshabilitada",
  unsettled: "Saldo impago en Meta",
  pending_review: "Cuenta en revisión de Meta",
  pending_settlement: "Pago pendiente de liquidar",
  grace_period: "Pago atrasado (período de gracia)",
  closed: "Cuenta publicitaria cerrada",
  no_funding: "Sin medio de pago",
  funding_unknown: "No se pudo leer el medio de pago",
  unknown_status: "Estado de la cuenta desconocido",
};

function statusReason(status: number | null): MetaBillingReason {
  switch (status) {
    case META_ACCOUNT_STATUS.ACTIVE:
      return "ok";
    case META_ACCOUNT_STATUS.DISABLED:
      return "disabled";
    case META_ACCOUNT_STATUS.UNSETTLED:
      return "unsettled";
    case META_ACCOUNT_STATUS.PENDING_RISK_REVIEW:
      return "pending_review";
    case META_ACCOUNT_STATUS.PENDING_SETTLEMENT:
      return "pending_settlement";
    case META_ACCOUNT_STATUS.IN_GRACE_PERIOD:
      return "grace_period";
    case META_ACCOUNT_STATUS.PENDING_CLOSURE:
    case META_ACCOUNT_STATUS.CLOSED:
      return "closed";
    default:
      return "unknown_status";
  }
}

/** Traduce el estado de la cuenta + medio de pago a un veredicto. */
export function evaluateMetaBilling(input: MetaBillingInput): MetaBillingEvaluation {
  const byStatus = statusReason(input.account_status);
  let reason: MetaBillingReason = byStatus;
  // La cuenta activa todavía puede no tener tarjeta: eso también es un problema.
  if (byStatus === "ok" && input.has_funding === false) reason = "no_funding";
  if (byStatus === "ok" && input.has_funding === null) reason = "funding_unknown";

  const alert =
    reason === "unsettled" || reason === "disabled"
      ? "critical"
      : reason === "no_funding"
        ? "warning"
        : null;
  return { reason, verified: reason === "ok", alert, label: LABELS[reason] };
}

export function metaBillingLabel(reason: MetaBillingReason): string {
  return LABELS[reason];
}

/** funding_source_details presente y con algún dato → hay medio de pago. */
export function hasFundingSource(details: unknown): boolean {
  if (!details || typeof details !== "object" || Array.isArray(details)) return false;
  const d = details as Record<string, unknown>;
  return Boolean(d.id || d.display_string || d.type);
}

/** "act_123" o "123" → "123" (solo dígitos); null si no es un id válido. */
export function normalizeAdAccountId(raw: string | null | undefined): string | null {
  const id = (raw ?? "").trim().replace(/^act_/, "");
  return /^\d{1,30}$/.test(id) ? id : null;
}

/** Monto de Meta (string o número) → número, o null. */
export function toAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Link a la configuración de pagos de la cuenta en el Centro de facturación de Meta. */
export function metaBillingHubUrl(adAccountId: string | null): string {
  const id = normalizeAdAccountId(adAccountId);
  return id
    ? `https://business.facebook.com/billing_hub/accounts/details?asset_id=${id}`
    : "https://business.facebook.com/billing_hub";
}

/** Mensaje para quien intenta activar una campaña sin pago verificado. */
export function metaActivationBlockedMessage(reason: MetaBillingReason): string {
  const why: Partial<Record<MetaBillingReason, string>> = {
    no_funding: "la cuenta publicitaria no tiene un medio de pago",
    unsettled: "la cuenta publicitaria tiene un saldo impago",
    disabled: "la cuenta publicitaria está deshabilitada",
    funding_unknown: "no pudimos leer el medio de pago de la cuenta",
  };
  const detail = why[reason] ?? `Meta informa: ${LABELS[reason].toLowerCase()}`;
  return (
    `No se puede activar: el pago de pauta de Meta no está verificado (${detail}). ` +
    "Pide al cliente que revise su tarjeta en Configuración de pagos de Meta, o guarda la campaña en pausa."
  );
}
