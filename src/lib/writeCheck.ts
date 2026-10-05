import { toast } from "sonner";

type WriteResult = {
  data: unknown[] | null;
  error: { code?: string; message: string } | null;
};

const PERMISSION_HINT = "no tienes permisos para editar esto o el registro ya no existe";

function isPermissionError(error: { code?: string; message: string }): boolean {
  return error.code === "42501" || /row-level security|permission denied/i.test(error.message);
}

/**
 * Revisa el resultado de una escritura hecha con `.select("id")`.
 * Con RLS, un update sin permisos no da error sino 0 filas: también lo tratamos como fallo.
 * Muestra un toast y devuelve true si la escritura NO se aplicó.
 */
export function writeFailed(result: WriteResult, label = "No se pudo guardar"): boolean {
  if (result.error) {
    const detail = isPermissionError(result.error) ? PERMISSION_HINT : result.error.message;
    toast.error(`${label}: ${detail}`);
    return true;
  }
  if (!result.data || result.data.length === 0) {
    toast.error(`${label}: ${PERMISSION_HINT}`);
    return true;
  }
  return false;
}

/** Igual que writeFailed pero para varias escrituras en paralelo (p. ej. reordenar). */
export function anyWriteFailed(results: WriteResult[], label = "No se pudo guardar"): boolean {
  const failed = results.find((r) => r.error || !r.data || r.data.length === 0);
  return failed ? writeFailed(failed, label) : false;
}

/**
 * Como writeFailed pero sin toast: devuelve el mensaje de error (o null si se
 * aplicó). Úsalo con `.select("id")`; 0 filas también cuenta como fallo.
 */
export function writeError(result: WriteResult, expectedRows = 1): string | null {
  if (result.error) {
    return isPermissionError(result.error) ? PERMISSION_HINT : result.error.message;
  }
  if (!result.data || result.data.length < expectedRows) return PERMISSION_HINT;
  return null;
}
