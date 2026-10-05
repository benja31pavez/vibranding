/**
 * Meta Marketing API money conversion.
 *
 * Meta expresses budgets, bids and spend caps (`daily_budget`, `lifetime_budget`,
 * `spend_cap`, `bid_amount`) as integers in the currency's minimum unit, defined
 * by a per-currency "offset":
 *
 *   https://developers.facebook.com/docs/marketing-api/currencies
 *   - offset 100: the minimum unit is 1/100 of the base unit ("1" = 0.01 USD)
 *   - offset 1:   the minimum unit is one base unit ("1" = 1 JPY)
 *
 * CLP, COP, JPY, KRW, etc. have offset 1, so multiplying a CLP budget by 100
 * would ask Meta to spend 100x the intended amount.
 *
 * Insights `spend` / `cpm` are NOT offset values: they come back as decimal
 * strings in the account currency's base unit and must not be converted here.
 */

/** Offsets copied from the official table (link above). Do not guess new ones. */
export const META_CURRENCY_OFFSETS: Readonly<Record<string, 1 | 100>> = Object.freeze({
  DZD: 100,
  ARS: 100,
  AUD: 100,
  BHD: 100,
  BDT: 100,
  BOB: 100,
  BGN: 100,
  BRL: 100,
  GBP: 100,
  CAD: 100,
  CLP: 1,
  CNY: 100,
  COP: 1,
  CRC: 1,
  HRK: 100,
  CZK: 100,
  DKK: 100,
  EGP: 100,
  EUR: 100,
  GTQ: 100,
  HNL: 100,
  HKD: 100,
  HUF: 1,
  ISK: 1,
  INR: 100,
  IDR: 1,
  ILS: 100,
  JPY: 1,
  JOD: 100,
  KES: 100,
  KRW: 1,
  LVL: 100,
  LTL: 100,
  MOP: 100,
  MYR: 100,
  MXN: 100,
  NZD: 100,
  NIO: 100,
  NGN: 100,
  NOK: 100,
  PKR: 100,
  PYG: 1,
  PEN: 100,
  PHP: 100,
  PLN: 100,
  QAR: 100,
  RON: 100,
  RUB: 100,
  SAR: 100,
  RSD: 100,
  SGD: 100,
  SKK: 100,
  ZAR: 100,
  SEK: 100,
  CHF: 100,
  TWD: 1,
  THB: 100,
  TRY: 100,
  AED: 100,
  UAH: 100,
  USD: 100,
  UYU: 100,
  VEF: 100,
  VND: 1,
  FBZ: 100,
  VES: 100,
});

export class MetaCurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaCurrencyError";
  }
}

function normalizeCode(currency: string | null | undefined): string {
  return (currency ?? "").trim().toUpperCase();
}

/** Offset for a currency; throws (fail closed) when the currency is unknown. */
export function getMetaCurrencyOffset(currency: string | null | undefined): 1 | 100 {
  const code = normalizeCode(currency);
  if (!code) {
    throw new MetaCurrencyError(
      "No se conoce la moneda de la cuenta publicitaria. Verifica la conexión con Meta antes de tocar presupuestos.",
    );
  }
  const offset = META_CURRENCY_OFFSETS[code];
  if (offset === undefined) {
    throw new MetaCurrencyError(
      `La moneda ${code} no está en la tabla de offsets de Meta soportada; no se envían presupuestos para evitar un cobro incorrecto.`,
    );
  }
  return offset;
}

/** Largest amount (base units) accepted for any Meta money field; anything above is a typo. */
export const MAX_META_AMOUNT = 1e12;

export interface ToMetaAmountOptions {
  /** 0 is rejected unless the caller explicitly allows it for this field. */
  allowZero?: boolean;
}

/**
 * Converts an amount in base units (e.g. 10000 CLP, 12.5 USD) to Meta's integer
 * minimum units. Rejects negatives, 0 (unless allowed), amounts above
 * MAX_META_AMOUNT, decimals on offset-1 currencies and sub-cent amounts on
 * offset-100 currencies, so nothing is silently rounded.
 */
export function toMetaAmount(
  amount: number | string,
  currency: string | null | undefined,
  options: ToMetaAmountOptions = {},
): number {
  const offset = getMetaCurrencyOffset(currency);
  const code = normalizeCode(currency);
  const value = typeof amount === "number" ? amount : Number(String(amount).trim() || NaN);
  if (!Number.isFinite(value) || value < 0) {
    throw new MetaCurrencyError(`Monto inválido para Meta: ${String(amount)}`);
  }
  if (value === 0 && !options.allowZero) {
    throw new MetaCurrencyError("Un monto de 0 no es válido para un presupuesto de Meta.");
  }
  if (value > MAX_META_AMOUNT) {
    throw new MetaCurrencyError(`Monto demasiado alto para Meta: ${String(amount)} ${code}`);
  }
  const scaled = value * offset;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-6) {
    throw new MetaCurrencyError(
      offset === 1
        ? `${code} no usa decimales en Meta: ${String(amount)} debe ser un número entero.`
        : `${code} admite como máximo 2 decimales en Meta: ${String(amount)}.`,
    );
  }
  return rounded;
}

/** Converts a Meta minimum-unit value (e.g. "10000" CLP, "1250" USD cents) back to base units. */
export function fromMetaAmount(
  value: number | string,
  currency: string | null | undefined,
): number {
  const offset = getMetaCurrencyOffset(currency);
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new MetaCurrencyError(`Valor de Meta inválido: ${String(value)}`);
  }
  return n / offset;
}

/** Like fromMetaAmount but maps empty/zero/absent values to null (Meta returns "0" or omits unset budgets). */
export function fromMetaAmountOrNull(
  value: number | string | null | undefined,
  currency: string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "" || Number(value) === 0) return null;
  return fromMetaAmount(value, currency);
}

/**
 * Safety cap on a DAILY budget, in base units of the ad account's currency.
 * Baseline: 500.000 CLP/day; other currencies are rough equivalents (2026),
 * kept deliberately round. A currency not listed here always requires
 * explicit confirmation (fail closed) instead of guessing an exchange rate.
 */
export const MAX_DAILY_BUDGET_WITHOUT_CONFIRMATION: Readonly<Record<string, number>> =
  Object.freeze({
    CLP: 500_000,
    USD: 550,
    EUR: 500,
    ARS: 550_000,
    BRL: 3_000,
    COP: 2_200_000,
    MXN: 10_000,
    PEN: 2_000,
    UYU: 22_000,
  });

/** Lifetime budgets and spend caps may be up to this many times the daily cap without confirmation. */
export const LIFETIME_CAP_MULTIPLIER = 15;

/** Money fields that go through the confirmation check. */
export type GuardedAmountKey = "daily" | "lifetime" | "spendCap" | "bid";
export type GuardedAmounts = Partial<Record<GuardedAmountKey, number | null | undefined>>;
export type ConfirmedAmounts = Partial<Record<GuardedAmountKey, number>>;

const AMOUNT_LABELS: Record<GuardedAmountKey, string> = {
  daily: "presupuesto diario",
  lifetime: "presupuesto total",
  spendCap: "límite de gasto",
  bid: "puja máxima",
};

/** Caps per field for a currency, or null when the currency has no defined cap. */
export function budgetLimitsFor(
  currency: string | null | undefined,
): Record<GuardedAmountKey, number> | null {
  const daily = MAX_DAILY_BUDGET_WITHOUT_CONFIRMATION[normalizeCode(currency)];
  if (daily === undefined) return null;
  const lifetime = daily * LIFETIME_CAP_MULTIPLIER;
  return { daily, lifetime, spendCap: lifetime, bid: daily };
}

export interface BudgetConfirmationRequest {
  /** User-facing explanation. */
  message: string;
  /** Exact amounts the user must confirm; send them back as `confirmedAmounts`. */
  amounts: ConfirmedAmounts;
}

/**
 * Checks every guarded amount against the currency caps. Returns null when all
 * are within caps or each exceeding amount was confirmed with the EXACT same
 * value; otherwise returns what still needs confirmation. Unknown-cap
 * currencies require confirmation of every positive amount.
 */
export function budgetConfirmationRequest(
  amounts: GuardedAmounts,
  currency: string | null | undefined,
  confirmed: ConfirmedAmounts | null | undefined,
): BudgetConfirmationRequest | null {
  const code = normalizeCode(currency);
  const limits = budgetLimitsFor(code);
  const fmt = (n: number) => `${n.toLocaleString("es-CL")} ${code}`;
  const pending: ConfirmedAmounts = {};
  const reasons: string[] = [];
  for (const key of Object.keys(AMOUNT_LABELS) as GuardedAmountKey[]) {
    const raw = amounts[key];
    if (raw === null || raw === undefined) continue;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const cap = limits?.[key];
    if (cap !== undefined && amount <= cap) continue;
    if (confirmed?.[key] === amount) continue;
    pending[key] = amount;
    reasons.push(
      cap === undefined
        ? `${AMOUNT_LABELS[key]} de ${fmt(amount)} (sin tope definido para ${code || "esta moneda"})`
        : `${AMOUNT_LABELS[key]} de ${fmt(amount)} supera el tope de ${fmt(cap)}`,
    );
  }
  if (reasons.length === 0) return null;
  return {
    message: `Requiere confirmación explícita: ${reasons.join("; ")}.`,
    amounts: pending,
  };
}

/** Error code returned by the API when an amount needs explicit confirmation. */
export const BUDGET_CONFIRMATION_REQUIRED = "BUDGET_CONFIRMATION_REQUIRED";
