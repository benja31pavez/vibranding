// Estado de facturación de Google Ads (lógica pura, sin red ni BD).
//
// Cada cliente paga su pauta con SU tarjeta en SU cuenta de Google Ads; la
// agencia solo administra desde la MCC. Para no quedar expuesta a saldos
// impagos, la plataforma revisa a diario el estado de la cuenta y del medio de
// pago y bloquea cualquier acción que active campañas si no está verificado.
//
// Campos de la API (REST v25, searchStream, camelCase):
//   customer.status                       ENABLED | CANCELED | SUSPENDED | CLOSED
//   billing_setup.status                  APPROVED | APPROVED_HELD | PENDING | CANCELLED
//   billing_setup.payments_account_info.payments_account_name
//   account_budget.status                 APPROVED | PENDING | CANCELLED
//   account_budget.approved_spending_limit_micros / _type (INFINITE = sin tope)
//   account_budget.amount_served_micros, account_budget.approved_end_date_time
import { flattenSearchStream, microsToClp } from "@/lib/google-ads/gaql";

export const BILLING_CUSTOMER_QUERY =
  "SELECT customer.id, customer.status, customer.currency_code, customer.descriptive_name FROM customer";

export const BILLING_SETUP_QUERY = [
  "SELECT billing_setup.id, billing_setup.status,",
  "billing_setup.payments_account_info.payments_account_name",
  "FROM billing_setup",
].join(" ");

export const ACCOUNT_BUDGET_QUERY = [
  "SELECT account_budget.id, account_budget.status,",
  "account_budget.approved_spending_limit_micros, account_budget.approved_spending_limit_type,",
  "account_budget.amount_served_micros, account_budget.approved_end_date_time",
  "FROM account_budget",
  "WHERE account_budget.status = 'APPROVED'",
].join(" ");

/** Mensaje del gate (texto exacto pedido por el dueño). */
export const BILLING_NOT_VERIFIED_MESSAGE =
  "El cliente aún no tiene un medio de pago verificado en Google Ads";

/** Un chequeo exitoso vale 72 h: si el cron deja de correr, el gate se cierra. */
export const BILLING_MAX_AGE_HOURS = 72;
const HOUR_MS = 3_600_000;

/** Tipo de alerta en campaign_alerts.kind (y su dedupe_key: una abierta por cliente). */
export const BILLING_ALERT_KIND = "billing_google";

export const GOOGLE_ADS_BILLING_URL = "https://ads.google.com/aw/billing/summary";

export type BillingVerdict = "verificado" | "pendiente" | "rechazado" | "sin_cuenta";

export const BILLING_VERDICT_LABEL: Readonly<Record<BillingVerdict, string>> = {
  verificado: "Verificado",
  pendiente: "Pendiente",
  rechazado: "Rechazado",
  sin_cuenta: "Sin cuenta",
};

export const BILLING_VERDICT_TONE: Readonly<
  Record<BillingVerdict, "success" | "warning" | "danger" | "neutral">
> = {
  verificado: "success",
  pendiente: "warning",
  rechazado: "danger",
  sin_cuenta: "neutral",
};

export function isBillingVerdict(v: unknown): v is BillingVerdict {
  return typeof v === "string" && v in BILLING_VERDICT_LABEL;
}

// ───────────────────────── parseo de respuestas ─────────────────────────

type Num = string | number | null | undefined;

type BillingRow = {
  customer?: { id?: Num; status?: string; currencyCode?: string; descriptiveName?: string };
  billingSetup?: {
    id?: Num;
    status?: string;
    paymentsAccountInfo?: { paymentsAccountName?: string };
  };
  accountBudget?: {
    id?: Num;
    status?: string;
    approvedSpendingLimitMicros?: Num;
    approvedSpendingLimitType?: string;
    amountServedMicros?: Num;
    approvedEndDateTime?: string;
  };
};

function rows(body: unknown): BillingRow[] {
  return flattenSearchStream(body) as unknown as BillingRow[];
}

export type CustomerInfo = { status: string | null; currency: string | null };

export function parseCustomerInfo(body: unknown): CustomerInfo {
  const c = rows(body)[0]?.customer;
  return { status: c?.status ?? null, currency: c?.currencyCode ?? null };
}

export type BillingSetupInfo = { status: string; paymentsAccountName: string | null };

export function parseBillingSetups(body: unknown): BillingSetupInfo[] {
  return rows(body)
    .map((r) => r.billingSetup)
    .filter((b): b is NonNullable<BillingRow["billingSetup"]> => Boolean(b?.status))
    .map((b) => ({
      status: String(b.status),
      paymentsAccountName: b.paymentsAccountInfo?.paymentsAccountName?.trim() || null,
    }));
}

export type AccountBudgetInfo = {
  /** null = sin tope (INFINITE). */
  limitClp: number | null;
  servedClp: number;
  endAt: string | null;
};

/**
 * Presupuesto de cuenta aprobado (solo cuentas en CLP; en otra moneda null).
 * Si hay varios, se usa el de mayor tope.
 */
export function parseAccountBudget(
  body: unknown,
  currency: string | null,
): AccountBudgetInfo | null {
  if (currency !== "CLP") return null;
  const budgets = rows(body)
    .map((r) => r.accountBudget)
    .filter((b): b is NonNullable<BillingRow["accountBudget"]> => b?.status === "APPROVED");
  if (budgets.length === 0) return null;
  const parsed = budgets.map((b) => ({
    limitClp:
      b.approvedSpendingLimitType === "INFINITE" || b.approvedSpendingLimitMicros == null
        ? null
        : microsToClp(b.approvedSpendingLimitMicros),
    servedClp: microsToClp(b.amountServedMicros),
    endAt: b.approvedEndDateTime ?? null,
  }));
  return parsed.sort((a, b) => (b.limitClp ?? Infinity) - (a.limitClp ?? Infinity))[0];
}

// ───────────────────────── evaluación ─────────────────────────

/** Orden de preferencia: basta un medio de pago aprobado para considerarlo válido. */
const SETUP_RANK: Readonly<Record<string, number>> = {
  APPROVED: 0,
  APPROVED_HELD: 1,
  PENDING: 2,
  CANCELLED: 3,
};

/** El mejor estado entre los billing_setup de la cuenta, o "NONE" si no hay ninguno. */
export function pickBillingStatus(setups: readonly BillingSetupInfo[]): string {
  if (setups.length === 0) return "NONE";
  return [...setups].sort((a, b) => (SETUP_RANK[a.status] ?? 9) - (SETUP_RANK[b.status] ?? 9))[0]
    .status;
}

const BLOCKED_CUSTOMER: Readonly<Record<string, string>> = {
  SUSPENDED: "Google suspendió la cuenta de Google Ads",
  CANCELED: "La cuenta de Google Ads está cancelada",
  CLOSED: "La cuenta de Google Ads está cerrada",
};

export type BillingEvaluation = {
  verdict: BillingVerdict;
  hasValidBilling: boolean;
  billingStatus: string | null;
  /** Explicación en español para el dueño. */
  detail: string;
  /** Cuenta suspendida/cancelada/cerrada (alerta crítica aunque haya tarjeta). */
  customerBlocked: boolean;
};

export function evaluateBilling(input: {
  linked: boolean;
  customerStatus: string | null;
  setups: readonly BillingSetupInfo[];
}): BillingEvaluation {
  if (!input.linked) {
    return {
      verdict: "sin_cuenta",
      hasValidBilling: false,
      billingStatus: null,
      detail: "El cliente no tiene una cuenta de Google Ads vinculada.",
      customerBlocked: false,
    };
  }
  const billingStatus = pickBillingStatus(input.setups);
  const blocked = input.customerStatus ? BLOCKED_CUSTOMER[input.customerStatus] : undefined;
  if (blocked) {
    return {
      verdict: "rechazado",
      hasValidBilling: false,
      billingStatus,
      detail: `${blocked}. Hay que revisar el pago o la política en Google Ads.`,
      customerBlocked: true,
    };
  }
  const base = { billingStatus, customerBlocked: false };
  switch (billingStatus) {
    case "APPROVED":
      return {
        ...base,
        verdict: "verificado",
        hasValidBilling: true,
        detail: "Medio de pago aprobado por Google.",
      };
    case "APPROVED_HELD":
      return {
        ...base,
        verdict: "pendiente",
        hasValidBilling: false,
        detail: "Google aprobó el medio de pago pero lo tiene retenido (verificación pendiente).",
      };
    case "PENDING":
      return {
        ...base,
        verdict: "pendiente",
        hasValidBilling: false,
        detail: "El medio de pago está en revisión por Google.",
      };
    case "CANCELLED":
      return {
        ...base,
        verdict: "rechazado",
        hasValidBilling: false,
        detail: "El medio de pago fue cancelado o rechazado. El cliente debe agregar otra tarjeta.",
      };
    case "NONE":
      return {
        ...base,
        verdict: "pendiente",
        hasValidBilling: false,
        detail: "La cuenta no tiene un medio de pago configurado.",
      };
    default:
      return {
        ...base,
        verdict: "pendiente",
        hasValidBilling: false,
        detail: `Estado de facturación desconocido (${billingStatus}).`,
      };
  }
}

// ───────────────────────── gate ─────────────────────────

export type BillingGateRow = {
  has_valid_billing: boolean;
  last_success_at: string | null;
  /** Cuenta revisada; debe ser la vinculada hoy (si cambió, el resultado no vale). */
  customer_id: string | null;
} | null;

/**
 * null si se puede activar campañas; si no, el mensaje en español.
 * Falla cerrado: sin fila, sin chequeo exitoso reciente, sin pago válido o si
 * el resultado es de otra cuenta que la vinculada hoy → bloquea.
 */
export function billingGateError(
  row: BillingGateRow,
  currentCustomerId: string | null,
  now: Date = new Date(),
): string | null {
  if (!row || !row.has_valid_billing || !row.last_success_at) return BILLING_NOT_VERIFIED_MESSAGE;
  if (!currentCustomerId || row.customer_id !== currentCustomerId) {
    return BILLING_NOT_VERIFIED_MESSAGE;
  }
  const age = now.getTime() - Date.parse(row.last_success_at);
  if (!Number.isFinite(age) || age > BILLING_MAX_AGE_HOURS * HOUR_MS) {
    return BILLING_NOT_VERIFIED_MESSAGE;
  }
  return null;
}

// ───────────────────────── alertas y mensajes ─────────────────────────

export type BillingAlertDraft = {
  kind: typeof BILLING_ALERT_KIND;
  dedupeKey: typeof BILLING_ALERT_KIND;
  severity: "warning" | "critical";
  message: string;
};

/** Alerta para Inicio, o null si el pago está verificado o no hay cuenta. */
export function billingAlert(
  evaluation: Pick<BillingEvaluation, "verdict" | "customerBlocked">,
  clientName: string,
): BillingAlertDraft | null {
  if (evaluation.verdict === "verificado" || evaluation.verdict === "sin_cuenta") return null;
  const name = clientName.trim() || "cliente";
  return {
    kind: BILLING_ALERT_KIND,
    dedupeKey: BILLING_ALERT_KIND,
    severity:
      evaluation.customerBlocked || evaluation.verdict === "rechazado" ? "critical" : "warning",
    message: `Pago de pauta: revisar Google Ads de ${name}`,
  };
}

/** Mensaje listo para WhatsApp/correo pidiendo al cliente actualizar su tarjeta. Nunca se envía solo. */
export function buildCardUpdateMessage(input: {
  clientName: string;
  contactName?: string | null;
  verdict?: BillingVerdict | null;
}): { subject: string; body: string } {
  const greeting = input.contactName?.trim() ? `Hola ${input.contactName.trim()}` : "Hola";
  const reason =
    input.verdict === "rechazado"
      ? "Google Ads nos informa que el medio de pago de tu cuenta fue rechazado o la cuenta quedó detenida"
      : "Google Ads nos informa que tu cuenta todavía no tiene un medio de pago verificado";
  return {
    subject: `Google Ads: actualizar medio de pago · ${input.clientName.trim() || "tu cuenta"}`,
    body: [
      `${greeting}, ¿cómo estás?`,
      "",
      `${reason}. Mientras no se resuelva, tus anuncios pueden detenerse.`,
      "",
      "Recuerda que la pauta se paga directamente a Google con tu tarjeta. Para revisarlo:",
      `1. Entra a ${GOOGLE_ADS_BILLING_URL}`,
      "2. Ve a Facturación → Configuración de pagos.",
      "3. Agrega o actualiza la tarjeta y confirma la verificación que pida Google.",
      "",
      "Si necesitas ayuda, respóndenos y lo vemos juntos.",
      "",
      "Equipo Vibranding",
    ].join("\n"),
  };
}
