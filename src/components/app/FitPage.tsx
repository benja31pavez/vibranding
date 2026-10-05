import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FitPageProps {
  /** Fila superior (normalmente `<PageHeader size="compact" />`). */
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Clases del área de contenido (p. ej. la grilla de columnas, con `md:grid-cols-*`). */
  contentClassName?: string;
  /**
   * Salida temporal: la página aún no está adaptada y hace scroll dentro del
   * área principal (fase 2 del rediseño "una pantalla").
   */
  scroll?: boolean;
}

/**
 * Pantalla del panel interno que, desde `md`, ocupa exactamente el alto
 * disponible del shell (sin scroll de página): encabezado + contenido `flex-1`.
 * En móvil fluye normal con scroll vertical.
 *
 * Los hijos que deban llenar el alto usan `md:min-h-0` (y `FitList` para listas).
 */
export function FitPage({ header, children, className, contentClassName, scroll }: FitPageProps) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[1600px] flex-col gap-6 px-6 py-8 md:px-10",
        !scroll && "md:h-full md:min-h-0 md:gap-4 md:overflow-hidden md:py-5",
        className,
      )}
    >
      {header && <div className="shrink-0">{header}</div>}
      <div className={cn("min-w-0", !scroll && "md:min-h-0 md:flex-1", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
