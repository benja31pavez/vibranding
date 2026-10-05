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
  throw new Error(`${context}: ${error.message ?? "unknown db error"}`);
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

export function escalationReason(lastError: string): string {
  return `El bot no pudo responder tras ${DISPATCH_MAX_ATTEMPTS} intentos: ${lastError.slice(0, 120)}`;
}
