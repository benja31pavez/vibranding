import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pagerItems } from "@/lib/layout/fitList";

export interface FitPagerProps {
  /** Página actual (0-based). */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Nombre de la lista para lectores de pantalla (p. ej. "Seguimientos"). */
  label: string;
  className?: string;
}

const BTN = "h-7 min-w-7 px-1 text-xs tabular-nums";

/** Paginador compacto: ‹ 1 2 … 9 ›. No se muestra con una sola página. */
export function FitPager({ page, pageCount, onPageChange, label, className }: FitPagerProps) {
  if (pageCount <= 1) return null;
  const items = pagerItems(pageCount, page);
  return (
    <nav aria-label={`Páginas de ${label}`} className={cn("flex items-center gap-0.5", className)}>
      <Button
        size="sm"
        variant="ghost"
        className={BTN}
        aria-label="Página anterior"
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft aria-hidden className="h-4 w-4" />
      </Button>
      {items.map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} aria-hidden className="px-0.5 text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={item}
            size="sm"
            variant={item - 1 === page ? "secondary" : "ghost"}
            className={BTN}
            aria-label={`Página ${item}`}
            aria-current={item - 1 === page ? "page" : undefined}
            onClick={() => onPageChange(item - 1)}
          >
            {item}
          </Button>
        ),
      )}
      <Button
        size="sm"
        variant="ghost"
        className={BTN}
        aria-label="Página siguiente"
        disabled={page >= pageCount - 1}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight aria-hidden className="h-4 w-4" />
      </Button>
    </nav>
  );
}
