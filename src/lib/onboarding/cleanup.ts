/**
 * Helpers puros de la limpieza del onboarding (sin Supabase), probados en
 * scripts/check-onboarding-cleanup.mjs.
 */

export interface OrphanRow {
  path: string;
  reason: string;
}

/** Códigos de "la función no existe" (migración aún no aplicada). */
const MISSING_RPC_CODES: ReadonlySet<string> = new Set(["PGRST202", "42883"]);

export function isMissingRpcError(error: { code?: string | null } | null | undefined): boolean {
  return !!error?.code && MISSING_RPC_CODES.has(error.code);
}

/** Filas válidas y deduplicadas por path (la primera razón gana). */
export function parseOrphanRows(data: unknown): OrphanRow[] {
  const rows = Array.isArray(data) ? data : [];
  const seen = new Set<string>();
  return rows.flatMap((r) => {
    const path = (r as { path?: unknown })?.path;
    const reason = (r as { reason?: unknown })?.reason;
    if (typeof path !== "string" || !path || seen.has(path)) return [];
    seen.add(path);
    return [{ path, reason: typeof reason === "string" ? reason : "desconocido" }];
  });
}

export function countReasons(rows: readonly OrphanRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>(
    (acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] ?? 0) + 1 }),
    {},
  );
}

export function chunk<T>(items: readonly T[], size: number, maxChunks: number): T[][] {
  if (size < 1) throw new Error("chunk: size debe ser >= 1");
  return Array.from({ length: Math.min(Math.ceil(items.length / size), Math.max(0, maxChunks)) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
}

/**
 * Paths de reservas cuyo lote de Storage terminó sin error: el archivo ya no
 * está (borrado ahora o antes), así que su reserva se puede borrar.
 */
export function reservationPathsToDelete(
  rows: readonly OrphanRow[],
  clearedPaths: ReadonlySet<string>,
): string[] {
  return rows.filter((r) => r.reason === "reserva_vencida" && clearedPaths.has(r.path)).map((r) => r.path);
}
