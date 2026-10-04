import type { ComponentType, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatDelta {
  /** Texto ya formateado, p. ej. "+12%" o "+$150.000". */
  label: string;
  direction: "up" | "down" | "flat";
  /** Si subir es malo (p. ej. morosidad), invierte los colores. */
  invert?: boolean;
}

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  delta?: StatDelta;
  hint?: ReactNode;
  loading?: boolean;
  className?: string;
}

function deltaTone({ direction, invert }: StatDelta): string {
  if (direction === "flat") return "text-muted-foreground";
  const good = direction === "up" ? !invert : Boolean(invert);
  return good ? "text-success-strong" : "text-danger-strong";
}

/** KPI compacto: etiqueta, valor grande con cifras tabulares, variación y pista. */
export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
  loading,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-app-lg border border-border-subtle bg-surface p-4 shadow-app-xs",
        className,
      )}
      aria-busy={loading || undefined}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon aria-hidden className="h-3.5 w-3.5" />}
        <span>{label}</span>
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-2 h-8 w-24" />
          <span className="sr-only">Cargando {label}</span>
        </>
      ) : (
        <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-foreground md:text-3xl">
          {value}
        </div>
      )}
      {!loading && (delta || hint) && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium tabular-nums",
                deltaTone(delta),
              )}
            >
              {delta.direction === "up" && <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />}
              {delta.direction === "down" && <ArrowDownRight aria-hidden className="h-3.5 w-3.5" />}
              {delta.label}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  );
}
