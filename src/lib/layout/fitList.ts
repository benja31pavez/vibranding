/**
 * Cálculos puros de las listas "a pantalla" (FitList): cuántos ítems caben en
 * un alto/ancho dado, la página actual y los números del paginador.
 * Sin React ni DOM para poder probarlos con scripts/check-fit-list.mjs.
 */

/** Tamaño de página antes de medir (SSR y primer pintado). */
export const DEFAULT_FIT_PAGE_SIZE = 5;

/** Páginas visibles alrededor de la actual en el paginador compacto. */
const PAGER_SIBLINGS = 1;

export type PagerItem = number | "gap";

export interface FitCountInput {
  /** Alto disponible (px). */
  available: number;
  /** Alto de una fila (px). */
  rowHeight: number;
  /** Separación entre filas (px). */
  gap?: number;
  /** Mínimo de filas aunque no quepan (siempre se muestra al menos 1). */
  min?: number;
}

/** Cuántas filas de `rowHeight` (+ `gap` entre ellas) caben en `available`. */
export function fitCount({ available, rowHeight, gap = 0, min = 1 }: FitCountInput): number {
  if (!Number.isFinite(available) || !Number.isFinite(rowHeight) || rowHeight <= 0) return min;
  const fits = Math.floor((Math.max(0, available) + gap) / (rowHeight + gap));
  return Math.max(min, fits);
}

export interface GridFitInput {
  width: number;
  height: number;
  /** Ancho mínimo de una tarjeta (px). */
  minColWidth: number;
  /** Alto de una tarjeta (px). */
  rowHeight: number;
  gap?: number;
  maxCols?: number;
}

export interface GridFit {
  cols: number;
  rows: number;
  pageSize: number;
}

/** Columnas × filas de tarjetas que caben en un rectángulo. */
export function gridFit({
  width,
  height,
  minColWidth,
  rowHeight,
  gap = 0,
  maxCols = Number.POSITIVE_INFINITY,
}: GridFitInput): GridFit {
  const cols = Math.min(
    Math.max(1, maxCols),
    fitCount({ available: width, rowHeight: minColWidth, gap }),
  );
  const rows = fitCount({ available: height, rowHeight, gap });
  return { cols, rows, pageSize: cols * rows };
}

export interface PageSlice {
  /** Página actual (0-based) ya acotada a [0, pageCount - 1]. */
  page: number;
  pageCount: number;
  start: number;
  /** Índice exclusivo. */
  end: number;
}

/** Página `page` (0-based) de una lista de `total` ítems; acota páginas fuera de rango. */
export function paginate(total: number, pageSize: number, page: number): PageSlice {
  const size = Math.max(1, Math.floor(pageSize));
  const count = Math.max(0, Math.floor(total));
  const pageCount = Math.max(1, Math.ceil(count / size));
  const current = Math.min(Math.max(0, Math.floor(page)), pageCount - 1);
  const start = current * size;
  return { page: current, pageCount, start, end: Math.min(count, start + size) };
}

/**
 * Página que contiene el ítem `firstIndex` con un tamaño de página nuevo
 * (al cambiar el alto, el primer ítem visible sigue en pantalla).
 */
export function pageForIndex(firstIndex: number, pageSize: number): number {
  return Math.floor(Math.max(0, firstIndex) / Math.max(1, Math.floor(pageSize)));
}

/**
 * Números del paginador compacto (1-based): primera, última, la actual y sus
 * vecinas; los saltos se marcan con "gap". `current` es 0-based.
 * Ej.: 10 páginas en la 5 → [1, "gap", 4, 5, 6, "gap", 10].
 */
export function pagerItems(pageCount: number, current: number): PagerItem[] {
  if (pageCount <= 1) return [];
  const here = Math.min(Math.max(0, current), pageCount - 1) + 1;
  const pages = new Set<number>([1, pageCount]);
  for (let p = here - PAGER_SIBLINGS; p <= here + PAGER_SIBLINGS; p += 1) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i): PagerItem[] => {
    const prev = sorted[i - 1];
    if (prev === undefined || p === prev + 1) return [p];
    // Un solo número saltado se muestra en vez de "…" (no ahorra espacio).
    return p === prev + 2 ? [prev + 1, p] : ["gap", p];
  });
}
