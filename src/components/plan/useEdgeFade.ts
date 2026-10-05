import { useCallback, useEffect, useRef, useState } from "react";

const FADE_TOLERANCE = 2;

/**
 * Marca si una fila con scroll horizontal tiene contenido oculto a cada lado
 * (`data-fade-start` / `data-fade-end`) para difuminar solo ese borde.
 */
export function useEdgeFade<T extends HTMLElement>(itemCount: number) {
  const ref = useRef<T | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft > FADE_TOLERANCE;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - FADE_TOLERANCE;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [update, itemCount]);
  return { ref, fadeStart: edges.start, fadeEnd: edges.end };
}
