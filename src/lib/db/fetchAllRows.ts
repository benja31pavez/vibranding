/**
 * PostgREST corta las respuestas en 1000 filas por defecto. Este helper pide
 * páginas de PAGE_SIZE con `.range()` hasta recibir una página incompleta, así
 * los totales nunca se truncan en silencio. La consulta debe tener un orden
 * estable (p. ej. `.order("id")`) para que las páginas no se solapen.
 */
/**
 * Debe ser <= `max_rows` de PostgREST (1000 en Supabase por defecto, ver
 * supabase/config.toml → [api] max_rows). Si la página pedida supera ese tope,
 * el servidor devuelve menos filas y el bucle cortaría antes de tiempo.
 */
export const PAGE_SIZE = 1000;

export type PageResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PageResult<T>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) return rows;
  }
}
