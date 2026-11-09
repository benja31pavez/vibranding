import type { ReactNode } from "react";

interface AppShellFrameProps {
  /** Header fijo de 56px (AppHeader). */
  header: ReactNode;
  /** Panel del cliente (solo desde md). */
  sidebar: ReactNode;
  /** Overlays fuera del flujo (paleta de comandos, etc.). */
  overlays?: ReactNode;
  /** Franja del cliente en teléfono (selector + chips), bajo la cabecera. */
  mobileBar?: ReactNode;
  /** Barra inferior fija en teléfono. */
  dock?: ReactNode;
  children: ReactNode;
}

/**
 * Estructura del panel interno. Desde `md` ocupa exactamente la ventana
 * (`h-dvh`, sin scroll de página): header + fila con sidebar y área principal
 * `flex-1 min-h-0`. Las pantallas adaptadas usan `FitPage` y llenan ese alto;
 * las aún no adaptadas hacen scroll dentro de `<main>` (fase 2).
 * En móvil todo fluye con el scroll normal del documento.
 */
export function AppShellFrame({
  header,
  sidebar,
  overlays,
  mobileBar,
  dock,
  children,
}: AppShellFrameProps) {
  return (
    <div className="app-brand flex min-h-screen flex-col bg-background md:h-dvh md:min-h-0 md:overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Saltar al contenido
      </a>
      {header}
      {overlays}

      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Panel del cliente"
          className="shell-sidebar-indigo hidden w-60 shrink-0 flex-col md:flex"
        >
          {sidebar}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
          {mobileBar}
          <main
            id="main"
            tabIndex={-1}
            className="min-w-0 flex-1 pb-20 focus:outline-none md:min-h-0 md:overflow-y-auto md:pb-0"
          >
            {children}
          </main>
        </div>
      </div>
      {dock}
    </div>
  );
}
