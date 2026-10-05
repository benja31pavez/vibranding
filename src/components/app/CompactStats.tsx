import type { ComponentType, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface CompactStat {
  key: string;
  label: string;
  value: ReactNode;
  /** Texto chico bajo el valor (una línea). */
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /** "danger" pinta el valor en rojo (p. ej. clientes en riesgo > 0). */
  tone?: "default" | "danger";
  loading?: boolean;
}

export interface CompactStatsProps {
  items: readonly CompactStat[];
  className?: string;
  /** Nombre del grupo para lectores de pantalla. */
  label?: string;
}

/** Franja de KPIs en una sola línea: etiqueta chica + valor, separados por divisores. */
export function CompactStats({ items, className, label = "Indicadores" }: CompactStatsProps) {
  return (
    <dl
      aria-label={label}
      className={cn(
        "grid auto-cols-fr grid-flow-col divide-x divide-border-subtle rounded-app-lg border border-border-subtle bg-surface shadow-app-xs",
        className,
      )}
    >
      {items.map(({ key, label: itemLabel, value, hint, icon: Icon, tone, loading }) => (
        <div key={key} className="min-w-0 px-3 py-2">
          <dt className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {Icon && <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />}
            {itemLabel}
          </dt>
          <dd
            className={cn(
              "truncate text-lg font-semibold tabular-nums text-foreground",
              tone === "danger" && "text-danger-strong",
            )}
          >
            {loading ? <Skeleton className="mt-1 h-5 w-10" /> : value}
          </dd>
          {hint && !loading && <dd className="truncate text-xs text-muted-foreground">{hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
