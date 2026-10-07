import { useState, type ComponentType, type ReactNode } from "react";
import { BarePanelProvider, InfoHint, brandTone } from "@/components/app";
import { cn } from "@/lib/utils";

export interface FichaCardProps {
  title: string;
  icon: ComponentType<{ className?: string }>;
  info?: ReactNode;
  /** Acciones del encabezado; un `Panel` adentro también dibuja aquí las suyas. */
  actions?: ReactNode;
  /** Desde md, llena el alto libre (listas con `FitList`). */
  fill?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Tarjeta de la ficha: encabezado de una línea (ícono, título, "i" y acciones)
 * y cuerpo. Un `Panel` adentro va en modo compacto y sus acciones suben al encabezado.
 */
export function FichaCard({
  title,
  icon: Icon,
  info,
  actions,
  fill = false,
  className,
  children,
}: FichaCardProps) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col rounded-app-lg border border-border-subtle bg-surface shadow-app-xs",
        fill && "md:min-h-0 md:flex-1",
        className,
      )}
    >
      <div className="flex min-h-11 shrink-0 items-center gap-2 px-4 pt-3 pb-2">
        <Icon aria-hidden className={cn("icon-chip h-4 w-4 shrink-0", brandTone(title))} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</h2>
        {info && <InfoHint label={`Información sobre ${title}`}>{info}</InfoHint>}
        <div
          ref={setSlot}
          className="flex shrink-0 items-center gap-1.5 empty:hidden [&_a]:text-xs [&_button]:h-7 [&_button]:px-2 [&_button]:text-xs"
        />
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      <div className={cn("min-w-0 px-4 pb-4", fill && "md:flex md:min-h-0 md:flex-1 md:flex-col")}>
        <BarePanelProvider actionsSlot={slot} fill={fill}>
          {children}
        </BarePanelProvider>
      </div>
    </section>
  );
}
