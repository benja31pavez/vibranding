/** PostgREST / Postgres: columna inexistente en el esquema (migración pendiente). */
const MISSING_COLUMN_CODES = new Set(["PGRST204", "42703"]);

export function isMissingColumnError(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && MISSING_COLUMN_CODES.has(error.code));
}
