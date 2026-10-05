/**
 * Columnas de nota del cliente en instagram_posts (migración
 * 20261012000300_portal_post_notes.sql). Mientras la migración no esté
 * aplicada, las lecturas y escrituras deben caer al comportamiento anterior.
 */
export const POST_NOTE_COLUMNS = "approval_note,approval_note_at,approval_note_read" as const;

/** Error de PostgREST/Postgres por columna inexistente (migración pendiente). */
export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column .* does not exist|could not find the .* column/i.test(error.message ?? "");
}
