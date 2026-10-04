import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DEFAULT_ROWS = 5;
const DEFAULT_COLUMNS = 4;

interface SkeletonGroupProps {
  rows?: number;
  label?: string;
  className?: string;
}

/** Lista en carga: filas con línea principal + secundaria. */
export function ListSkeleton({
  rows = DEFAULT_ROWS,
  label = "Cargando…",
  className,
}: SkeletonGroupProps) {
  return (
    <div role="status" aria-live="polite" aria-busy className={cn("space-y-3", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Tabla en carga: encabezado + filas con N columnas. */
export function TableSkeleton({
  rows = DEFAULT_ROWS,
  columns = DEFAULT_COLUMNS,
  label = "Cargando…",
  className,
}: SkeletonGroupProps & { columns?: number }) {
  const grid = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy
      className={cn(
        "overflow-hidden rounded-app-lg border border-border-subtle bg-surface",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      <div
        className="grid gap-4 border-b border-border-subtle bg-surface-2 px-4 py-2.5"
        style={grid}
      >
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} className="h-3 w-1/2" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid gap-4 border-b border-border-subtle px-4 py-3 last:border-0"
          style={grid}
        >
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-3/4" : "w-1/2")} />
          ))}
        </div>
      ))}
    </div>
  );
}
