import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Márgenes estándar de una pantalla de la plataforma (los de Prospectos):
 * mismo padding en todas las páginas, contenido alineado a la izquierda junto al
 * sidebar y un ancho máximo amplio solo para pantallas muy grandes.
 */
export const PAGE_CONTAINER_CLASS = "w-full max-w-[1600px] px-6 py-8 md:px-10";

export interface PageContainerProps {
  children: ReactNode;
  /** Clases extra (p. ej. `space-y-6`). No usar para cambiar el padding ni centrar. */
  className?: string;
}

/** Contenedor único de página: úsalo como raíz de cada pantalla bajo `/_app`. */
export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={cn(PAGE_CONTAINER_CLASS, className)}>{children}</div>;
}
