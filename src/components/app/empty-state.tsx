import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** "compact" para usar dentro de un Panel. */
  size?: "default" | "compact";
  className?: string;
}

/** Estado vacío: explica qué falta y ofrece la siguiente acción. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "default",
  className,
}: EmptyStateProps) {
  const compact = size === "compact";
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact
          ? "gap-1.5 py-6"
          : "gap-2 rounded-app-lg border border-dashed border-border-strong bg-surface px-6 py-12",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "grid place-items-center rounded-app-md bg-surface-2 text-muted-foreground",
            compact ? "h-8 w-8" : "mb-1 h-11 w-11",
          )}
        >
          <Icon aria-hidden className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </div>
      )}
      <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>
        {title}
      </p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
