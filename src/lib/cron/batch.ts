// Helpers puros para los endpoints que el cron llama por lotes
// (public.run_http_cron_job corta cada petición a los 15 s).

const INT_RE = /^\d{1,6}$/;

/**
 * Lote de la ingesta de Meta: cada cuenta tarda 3 s o más (reporte asíncrono),
 * así que 3 cuentas caben en los 15 s del cron.
 */
export const META_MAX_BATCH_LIMIT = 3;

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

/** 200 si todo salió bien, 207 si algunos fallaron, 500 si ninguno funcionó. */
export function batchStatus(failed: number, succeeded: number): 200 | 207 | 500 {
  if (failed === 0) return 200;
  return succeeded > 0 ? 207 : 500;
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
