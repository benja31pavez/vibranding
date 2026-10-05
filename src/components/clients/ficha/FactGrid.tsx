import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Fact {
  label: string;
  value: ReactNode;
}

/** Datos de solo lectura en columnas (etiqueta chica arriba, valor abajo). */
export function FactGrid({
  facts,
  columns = 2,
  className,
}: {
  facts: readonly Fact[];
  columns?: 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-3 gap-y-1",
        columns === 3 ? "grid-cols-3" : "grid-cols-2",
        className,
      )}
    >
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="text-xs leading-4 text-muted-foreground">{fact.label}</dt>
          <dd className="truncate text-sm text-foreground">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
