import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /** Acciones a la derecha del encabezado. */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Tono del borde/fondo; "warning" para avisos que requieren atención. */
  tone?: "default" | "warning";
}

const toneCls = {
  default: "border-border-subtle bg-surface",
  warning: "border-warning/40 bg-warning-subtle",
} as const;

/** Tarjeta estándar con encabezado (título, descripción, acciones) y cuerpo. */
export function Panel({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
  tone = "default",
}: PanelProps) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section className={cn("rounded-app-lg border shadow-app-xs", toneCls[tone], className)}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {Icon && <Icon aria-hidden className="h-4 w-4 text-muted-foreground" />}
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("px-5 pb-5", hasHeader ? "pt-3" : "pt-5", bodyClassName)}>{children}</div>
    </section>
  );
}
