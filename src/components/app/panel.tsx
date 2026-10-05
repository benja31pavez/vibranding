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
  /** Desde md, llena el alto del padre (columna de `FitPage`); el cuerpo es `flex-1 min-h-0`. */
  fill?: boolean;
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
  fill = false,
}: PanelProps) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section
      className={cn(
        "rounded-app-lg border shadow-app-xs",
        toneCls[tone],
        fill && "md:flex md:min-h-0 md:flex-1 md:flex-col",
        className,
      )}
    >
      {hasHeader && (
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {Icon && <Icon aria-hidden className="h-4 w-4 text-muted-foreground" />}
                {title}
              </h2>
            )}
            {description && (
              <p
                className={cn(
                  "mt-0.5 text-xs text-muted-foreground",
                  // En pantallas medianas las tarjetas que llenan el alto priorizan el contenido.
                  fill && "md:max-lg:hidden",
                )}
              >
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div
        className={cn(
          "px-5 pb-5",
          hasHeader ? "pt-3" : "pt-5",
          fill && "md:flex md:min-h-0 md:flex-1 md:flex-col",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
