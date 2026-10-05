// Helpers puros para los endpoints que el cron llama por lotes
// (public.run_http_cron_job corta cada petición a los 15 s).

const INT_RE = /^\d{1,6}$/;

/**
 * Lote de la ingesta de Meta: cada cuenta tarda 3 s o más (reporte asíncrono),
 * así que 3 cuentas caben en los 15 s del cron.
 */
export const META_MAX_BATCH_LIMIT = 3;

/**
 * Presupuesto de tiempo por llamada: run_http_cron_job corta a los 15 s, así
 * que el endpoint responde antes (a los 12 s) para que el resultado quede en job_runs.
 */
export const CRON_CALL_BUDGET_MS = 12_000;

/** Los jobs del cron siempre mandan ?offset=; una llamada sin offset es manual o del job viejo. */
export function isBatchedCall(params: URLSearchParams): boolean {
  return params.has("offset");
}

export type BatchParams = { offset: number; limit: number; last: boolean };

/**
 * `&last=1` lo lleva solo la URL del ÚLTIMO job programado de cada serie.
 * Ausente = false; cualquier valor distinto de "1" o "0" es un error.
 */
export function parseLastFlag(params: URLSearchParams): boolean | { error: string } {
  const raw = params.get("last");
  if (raw === null || raw === "0") return false;
  if (raw === "1") return true;
  return { error: "last debe ser 1 o 0" };
}

/** offset (entero >= 0), limit (1..maxLimit) y last. */
export function parseBatchParams(
  params: URLSearchParams,
  opts: { defaultLimit: number; maxLimit: number },
): BatchParams | { error: string } {
  const offset = params.get("offset") ?? "0";
  const limit = params.get("limit") ?? String(opts.defaultLimit);
  if (!INT_RE.test(offset)) return { error: "offset debe ser un entero >= 0" };
  if (!INT_RE.test(limit) || Number(limit) < 1 || Number(limit) > opts.maxLimit) {
    return { error: `limit debe estar entre 1 y ${opts.maxLimit}` };
  }
  const last = parseLastFlag(params);
  if (typeof last === "object") return last;
  return { offset: Number(offset), limit: Number(limit), last };
}

/**
 * Si el último job programado todavía deja cuentas/clientes sin procesar,
 * los offsets fijos del cron no cubren todo: hay que agregar un job.
 * Devuelve el mensaje de error, o null si no falta nada.
 */
export function missingBatchesError(last: boolean, nextOffset: number | null): string | null {
  if (!last || nextOffset === null) return null;
  return `faltan lotes: agrega un job con offset ${nextOffset}`;
}

/**
 * 200 si todo salió bien; 500 si algo falló. Estos endpoints solo los llama
 * el cron y job_runs cuenta cualquier 2xx (incluido 207) como éxito, así que
 * un lote con fallos nunca puede responder 2xx. El detalle va en el cuerpo.
 */
export function batchStatus(failed: number): 200 | 500 {
  return failed === 0 ? 200 : 500;
}

/**
 * Espera `work` hasta `deadlineMs` (epoch ms). Si no termina a tiempo devuelve
 * `onTimeout()`; la promesa original sigue sola (no se cancela).
 */
export async function withDeadline<T>(
  work: Promise<T>,
  deadlineMs: number,
  onTimeout: () => T,
  now: () => number = Date.now,
): Promise<T> {
  const remaining = deadlineMs - now();
  if (remaining <= 0) return onTimeout();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout()), remaining);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pide `limit + 1` filas para saber si queda otro lote: devuelve el lote y el
 * siguiente offset (null si no quedan más).
 */
export function splitBatch<T>(
  rows: readonly T[],
  offset: number,
  limit: number,
): { batch: T[]; nextOffset: number | null } {
  return {
    batch: rows.slice(0, limit),
    nextOffset: rows.length > limit ? offset + limit : null,
  };
}
