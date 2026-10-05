import { createContext, useContext, type ReactNode } from "react";

export interface BarePanelSlots {
  /** Nodo del encabezado de la sección donde se dibujan las acciones del Panel. */
  actionsSlot: HTMLElement | null;
  /** El Panel llena el alto del padre (listas con `FitList`). */
  fill: boolean;
}

const BarePanelContext = createContext<BarePanelSlots | null>(null);

/**
 * Dentro de este proveedor, `Panel` se dibuja sin tarjeta ni título (los pone
 * la sección que lo contiene, p. ej. las secciones plegables de la ficha) y
 * `EmptyState` queda en una sola línea.
 */
export function BarePanelProvider({
  actionsSlot = null,
  fill = false,
  children,
}: Partial<BarePanelSlots> & { children: ReactNode }) {
  return (
    <BarePanelContext.Provider value={{ actionsSlot, fill }}>{children}</BarePanelContext.Provider>
  );
}

/** `null` fuera de una sección compacta. */
export function useBarePanel(): BarePanelSlots | null {
  return useContext(BarePanelContext);
}
