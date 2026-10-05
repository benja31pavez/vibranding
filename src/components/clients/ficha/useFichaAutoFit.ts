import { useEffect, useRef, useState, type RefObject } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/use-desktop";
import { isSectionId, planCollapse, type FichaSections, type FitCandidate } from "./sectionState";

/** Atributo de las columnas que no deben crecer más que la pantalla. */
export const FIT_COLUMN_ATTR = "data-fit-column";
/** Atributo con el id de cada sección plegable. */
export const SECTION_ID_ATTR = "data-section-id";

const OVERFLOW_TOLERANCE_PX = 1;

/** Secciones de la columna que se pueden plegar (no la que se está editando) y cuánto liberan. */
function candidatesIn(column: HTMLElement): FitCandidate[] {
  const active = document.activeElement;
  return [...column.querySelectorAll<HTMLElement>(`[${SECTION_ID_ATTR}]`)].flatMap((section) => {
    const id = section.getAttribute(SECTION_ID_ATTR) ?? undefined;
    if (!isSectionId(id) || (active && section.contains(active))) return [];
    const head = section.firstElementChild;
    const headHeight = head ? head.getBoundingClientRect().height : 0;
    // clientHeight: sin bordes (la sección plegada los conserva).
    return [{ id, savings: section.clientHeight - headHeight }];
  });
}

/**
 * En escritorio, si una columna de la ficha no cabe en la pantalla, pliega
 * secciones por prioridad (sin tocar lo que el usuario abrió o plegó a mano)
 * hasta que quepa. Cada vez que algo cambia de alto (llegan datos, cambia la
 * ventana, el usuario abre algo) vuelve a medir con todo abierto; como ocurre
 * en efectos de layout, el recálculo no se alcanza a ver. En móvil las
 * columnas no tienen alto fijo y nada se pliega.
 */
export function useFichaAutoFit(
  containerRef: RefObject<HTMLElement | null>,
  sections: FichaSections,
) {
  const { isAutoCollapsible, autoCollapse, resetAutoCollapse, autoCollapsedCount } = sections;
  // Sube cuando una columna o sección cambia de tamaño, o cambia la ventana.
  const [measureTick, setMeasureTick] = useState(0);
  const fittedTick = useRef<number | null>(null);

  // Una vez por medición: primero todo abierto (lo que no eligió el usuario) y, con
  // esos altos, se decide de una vez qué plegar en cada columna que no cabe.
  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || fittedTick.current === measureTick) return;
    if (autoCollapsedCount > 0) {
      resetAutoCollapse();
      return;
    }
    fittedTick.current = measureTick;
    const plan = [...container.querySelectorAll<HTMLElement>(`[${FIT_COLUMN_ATTR}]`)].flatMap(
      (column) => {
        const excess = column.scrollHeight - column.clientHeight;
        if (excess <= OVERFLOW_TOLERANCE_PX) return [];
        return planCollapse(excess, candidatesIn(column), isAutoCollapsible);
      },
    );
    autoCollapse(plan);
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const remeasure = () => setMeasureTick((n) => n + 1);
    const observer = new ResizeObserver(remeasure);
    const observed = new WeakSet<HTMLElement>();
    // Solo se observan las columnas y secciones nuevas (volver a observar dispara otra medición).
    const observeNew = () => {
      container
        .querySelectorAll<HTMLElement>(`[${FIT_COLUMN_ATTR}], [${SECTION_ID_ATTR}]`)
        .forEach((el) => {
          if (observed.has(el)) return;
          observed.add(el);
          observer.observe(el);
        });
    };
    observeNew();
    const mutations = new MutationObserver(observeNew);
    mutations.observe(container, { childList: true, subtree: true });
    window.addEventListener("resize", remeasure);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", remeasure);
    };
  }, [containerRef]);
}
