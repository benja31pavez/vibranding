// Pure helpers for at-least-once message delivery (Instagram webhook and
// WhatsApp AI dispatch). No I/O here so scripts/check-mensajeria.mjs can test it.

/** Postgres unique_violation. */
export const UNIQUE_VIOLATION = "23505";

/** Seconds to wait before retrying a failed AI reply. */
export const DISPATCH_RETRY_DELAY_MS = 30_000;

/** After this many failed attempts the conversation goes to a human. */
export const DISPATCH_MAX_ATTEMPTS = 3;

type DbError = { code?: string | null; message?: string | null } | null | undefined;

export function isUniqueViolation(error: DbError): boolean {
  if (!error) return false;
  if (error.code === UNIQUE_VIOLATION) return true;
  return /duplicate key|unique constraint/i.test(error.message ?? "");
}

export type InsertOutcome = "inserted" | "duplicate";

/**
 * Turns an insert result into "inserted" / "duplicate" (already processed).
 * Any other error is thrown so the caller fails loudly and the sender retries.
 */
export function classifyInsert(error: DbError, context: string): InsertOutcome {
  if (!error) return "inserted";
  if (isUniqueViolation(error)) return "duplicate";
  throw dbError(context, error);
}

/**
 * Webhook HTTP status: 200 only when every event was handled, so Meta retries
 * the delivery when something failed (handlers are idempotent).
 */
export function webhookStatus(failures: number): 200 | 500 {
  return failures > 0 ? 500 : 200;
}

export type DispatchRetryPlan =
  | { escalate: false; attempts: number; pendingResponseAt: string }
  | { escalate: true; attempts: number; pendingResponseAt: null };

/**
 * What to do after a failed AI reply attempt. `previousAttempts` is the stored
 * counter before this failure.
 */
export function planDispatchRetry(previousAttempts: number | null | undefined, now: Date): DispatchRetryPlan {
  const attempts = Math.max(0, Number(previousAttempts) || 0) + 1;
  if (attempts >= DISPATCH_MAX_ATTEMPTS) {
    return { escalate: true, attempts, pendingResponseAt: null };
  }
  return {
    escalate: false,
    attempts,
    pendingResponseAt: new Date(now.getTime() + DISPATCH_RETRY_DELAY_MS).toISOString(),
  };
}

/** Lease on a claimed WhatsApp reply: if the runner dies, it is retried after this. */
export const DISPATCH_LEASE_MS = 5 * 60_000;

/** Timeout for outbound HTTP calls (Meta Graph, AI gateway). */
export const OUTBOUND_TIMEOUT_MS = 15_000;

/** Masks long digit runs (phone numbers, ids) before they reach logs or the UI. */
export function redactDigits(text: string): string {
  return text.replace(/\d{7,}/g, "[redactado]");
}

export function escalationReason(lastError: string): string {
  return `El bot no pudo responder tras ${DISPATCH_MAX_ATTEMPTS} intentos: ${redactDigits(lastError).slice(0, 120)}`;
}

/** A failure a retry cannot fix (validation, schema, revoked token, Meta 4xx). */
export class PermanentError extends Error {
  readonly permanent = true;
}

/** Error carrying the Postgres/PostgREST code so the webhook can classify it. */
export function dbError(context: string, error: { code?: string | null; message?: string | null }): Error {
  const err = new Error(`${context}: ${error.message ?? "db error"}`) as Error & { code?: string };
  if (error.code) err.code = error.code;
  return err;
}

// Postgres classes a retry will not fix: data exception, integrity, syntax /
// undefined column (schema), PL/pgSQL raise. PGRST1xx/2xx = bad request / schema cache.
const PERMANENT_CODE = /^(22|23|42|P0)|^PGRST[12]/;

/**
 * True when Meta should redeliver: DB/network/timeouts/5xx. Errors without a
 * code (fetch failed, aborted) are treated as transient.
 */
export function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== "object") return true;
  const e = err as { permanent?: boolean; code?: unknown; status?: unknown };
  if (e.permanent) return false;
  if (typeof e.status === "number") return e.status >= 500 || e.status === 429;
  if (typeof e.code === "string" && e.code) return !PERMANENT_CODE.test(e.code);
  return true;
}
