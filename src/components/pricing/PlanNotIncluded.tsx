import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lista "No incluye" de un plan: más chica y apagada que la lista de lo que sí
 * incluye, con ✕ en vez de ✓. Los textos vienen de `Plan.notIncluded` (plans.ts).
 */
export function PlanNotIncluded({
  items,
  className,
  listClassName,
}: {
  items: readonly string[];
  className?: string;
  listClassName?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={cn("text-xs text-muted-foreground", className)}>
      <p className="font-semibold uppercase tracking-wide">No incluye</p>
      <ul className={cn("mt-2 space-y-1.5", listClassName)}>
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <X aria-hidden className="mt-px h-3.5 w-3.5 shrink-0 opacity-70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
