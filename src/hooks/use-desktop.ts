import { useEffect, useLayoutEffect, useState } from "react";

/** Breakpoint `md` de Tailwind: desde aquí el panel interno cabe en una pantalla. */
export const DESKTOP_MIN_WIDTH = 768;

/** useLayoutEffect en el cliente (mide antes de pintar) sin avisos en SSR. */
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * `true` desde `md` (≥ 768px). En SSR y en el primer render vale `false`
 * (mismo HTML que el servidor) y se corrige antes del primer pintado.
 */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useIsomorphicLayoutEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const sync = () => setDesktop(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);
  return desktop;
}
