import type { ComponentType, ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useBarePanel } from "./bare-panel";
import { InfoHint } from "./InfoHint";

export interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  /**
   * Texto de ayuda: va en un ícono "i" junto al título. En modo compacto no se
   * dibuja (lo muestra la sección o el panel lateral que lo contiene).
   */
  info?: ReactNode;
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
  info,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
  tone = "default",
  fill = false,
}: PanelProps) {
  const bare = useBarePanel();
  if (bare) {
    const inlineActions = actions && !bare.actionsSlot;
    return (
      <div className={cn("flex min-w-0 flex-col gap-2", bare.fill && "md:min-h-0 md:flex-1")}>
        {actions && bare.actionsSlot && createPortal(actions, bare.actionsSlot)}
        {(description || inlineActions) && (
          <div className="flex shrink-0 items-start justify-between gap-2">
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            {inlineActions && (
              <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
            )}
          </div>
        )}
        <div className={cn("min-w-0", bare.fill && "md:flex md:min-h-0 md:flex-1 md:flex-col")}>
          {children}
        </div>
      </div>
    );
  }
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
                {info && <InfoHint>{info}</InfoHint>}
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
