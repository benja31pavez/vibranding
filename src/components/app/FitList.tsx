import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsDesktop, useIsomorphicLayoutEffect } from "@/hooks/use-desktop";
import {
  DEFAULT_FIT_PAGE_SIZE,
  fitCount,
  gridFit,
  pageForIndex,
  paginate,
} from "@/lib/layout/fitList";
import { FitPager } from "./FitPager";

export interface FitListRenderContext {
  /** `true` dentro del panel lateral "Ver todos". */
  inSheet: boolean;
}

export interface FitListProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  /** Contenido de cada fila/tarjeta (FitList pone el `<li>`). */
  renderItem: (item: T, ctx: FitListRenderContext) => ReactNode;
  /** Nombre de la lista: título del panel "Ver todos" y etiqueta del paginador. */
  label: string;
  sheetDescription?: ReactNode;
  /** "list": filas apiladas. "grid": tarjetas en columnas × filas que caben. */
  variant?: "list" | "grid";
  /** grid: ancho mínimo de una tarjeta (px). */
  minColWidth?: number;
  maxCols?: number;
  /** Separación entre filas/tarjetas (px). Por defecto 0 en lista y 12 en grid. */
  gap?: number;
  /** Lista: líneas divisorias entre filas. */
  divided?: boolean;
  /** Tamaño de página antes de medir (SSR) y en móvil si `mobileShowAll` es false. */
  defaultPageSize?: number;
  /** Móvil: `true` muestra todo con scroll normal (como antes); `false` pagina. */
  mobileShowAll?: boolean;
  /** grid en móvil (sin medir): clases de columnas. */
  mobileGridClassName?: string;
  className?: string;
  /** Clases extra del `<li>` (también en el panel "Ver todos"). */
  itemClassName?: string;
}

interface FitLayout {
  cols: number;
  pageSize: number;
}

const GRID_GAP = 12;
const OVERFLOW_TOLERANCE_PX = 1;

function averageRowHeight(rows: readonly HTMLElement[]): number {
  const total = rows.reduce((sum, r) => sum + r.getBoundingClientRect().height, 0);
  return rows.length > 0 ? total / rows.length : 0;
}

/**
 * Lista que, en escritorio, muestra solo los ítems que caben en el alto
 * disponible (sin scroll interno), con paginador y "Ver todos (N)" que abre la
 * lista completa en un panel lateral. En móvil fluye normal (scroll de página).
 *
 * El contenedor padre debe darle alto en escritorio (p. ej. `flex-1 min-h-0`
 * dentro de una columna de `FitPage`).
 */
export function FitList<T>({
  items,
  getKey,
  renderItem,
  label,
  sheetDescription,
  variant = "list",
  minColWidth = 260,
  maxCols,
  gap,
  divided = variant === "list",
  defaultPageSize = DEFAULT_FIT_PAGE_SIZE,
  mobileShowAll = false,
  mobileGridClassName = "sm:grid-cols-2",
  className,
  itemClassName,
}: FitListProps<T>) {
  const desktop = useIsDesktop();
  const grid = variant === "grid";
  const gapPx = gap ?? (grid ? GRID_GAP : 0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [layout, setLayout] = useState<FitLayout>({ cols: 1, pageSize: defaultPageSize });
  const [page, setPage] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Volver a estimar tras un cambio de tamaño o de cantidad de ítems.
  const needsEstimate = useRef(true);
  const measuredCount = useRef(items.length);
  const [, setResizeTick] = useState(0);

  const showAll = !desktop && mobileShowAll;
  const pageSize = desktop ? layout.pageSize : defaultPageSize;
  const slice = showAll
    ? { page: 0, pageCount: 1, start: 0, end: items.length }
    : paginate(items.length, pageSize, page);
  const visible = items.slice(slice.start, slice.end);

  const applyLayout = (next: FitLayout) => {
    if (next.cols === layout.cols && next.pageSize === layout.pageSize) return false;
    setLayout(next);
    setPage(pageForIndex(slice.start, next.pageSize));
    return true;
  };

  useEffect(() => {
    if (!desktop) return;
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      needsEstimate.current = true;
      setResizeTick((t) => t + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [desktop]);

  // Tras cada render en escritorio: estimar con la altura medida y, si aun así
  // se desborda (filas de alto variable), quitar una fila. Corre antes de pintar.
  useIsomorphicLayoutEffect(() => {
    if (!desktop) return;
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!viewport || !list) return;
    const rows = Array.from(list.children) as HTMLElement[];
    if (rows.length === 0) return;
    if (measuredCount.current !== items.length) {
      measuredCount.current = items.length;
      needsEstimate.current = true;
    }
    const height = viewport.clientHeight;
    if (needsEstimate.current) {
      needsEstimate.current = false;
      if (grid) {
        const rowHeight = Math.max(...rows.map((r) => r.getBoundingClientRect().height));
        const fit = gridFit({
          width: viewport.clientWidth,
          height,
          minColWidth,
          rowHeight,
          gap: gapPx,
          maxCols,
        });
        // Al cambiar de columnas cambia el alto de las tarjetas: se vuelve a medir.
        if (fit.cols !== layout.cols) needsEstimate.current = true;
        if (applyLayout({ cols: fit.cols, pageSize: fit.pageSize })) return;
      } else {
        const rowHeight = averageRowHeight(rows);
        const pageSizeFit = fitCount({ available: height, rowHeight, gap: gapPx });
        if (applyLayout({ cols: 1, pageSize: pageSizeFit })) return;
      }
    }
    const overflow = list.getBoundingClientRect().height > height + OVERFLOW_TOLERANCE_PX;
    if (overflow && layout.pageSize > layout.cols) {
      applyLayout({ cols: layout.cols, pageSize: layout.pageSize - layout.cols });
    }
  });

  const listStyle: CSSProperties | undefined =
    desktop && grid
      ? { gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`, gap: gapPx }
      : { gap: gapPx };
  const listClass = cn(
    grid ? "grid" : "flex flex-col",
    grid && !desktop && cn("grid-cols-1", mobileGridClassName),
    divided && "divide-y divide-border-subtle",
  );
  const hasMore = items.length > visible.length;

  return (
    <div className={cn("flex min-w-0 flex-col", desktop && "min-h-0 flex-1", className)}>
      <div ref={viewportRef} className={cn(desktop && "min-h-0 flex-1 overflow-hidden")}>
        <ul ref={listRef} aria-label={label} className={listClass} style={listStyle}>
          {visible.map((item) => (
            <li key={getKey(item)} className={cn("min-w-0", itemClassName)}>
              {renderItem(item, { inSheet: false })}
            </li>
          ))}
        </ul>
      </div>
      {hasMore && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-2">
          <FitPager
            page={slice.page}
            pageCount={slice.pageCount}
            onPageChange={setPage}
            label={label}
          />
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 px-2 text-xs"
            onClick={() => setSheetOpen(true)}
          >
            Ver todos ({items.length})
          </Button>
        </div>
      )}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 pb-3 pt-6 text-left">
            <SheetTitle>
              {label} ({items.length})
            </SheetTitle>
            <SheetDescription className={cn(!sheetDescription && "sr-only")}>
              {sheetDescription ?? `Lista completa de ${label.toLowerCase()}.`}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
            <ul
              aria-label={`${label}: todos`}
              className={cn(
                grid ? "grid gap-3" : "flex flex-col",
                divided && "divide-y divide-border-subtle",
              )}
            >
              {items.map((item) => (
                <li key={getKey(item)} className={cn("min-w-0", itemClassName)}>
                  {renderItem(item, { inSheet: true })}
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
