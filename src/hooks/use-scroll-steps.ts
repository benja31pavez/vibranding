import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./use-motion";

/** The step crossing this band (the middle of the viewport) is the active one. */
const ACTIVE_BAND_MARGIN = "-45% 0px -45% 0px";

export interface ScrollSteps {
  /** Attach to the list; its direct `li` children are the steps. */
  listRef: React.RefObject<HTMLOListElement | null>;
  /** JS is running, IntersectionObserver exists and motion is allowed. */
  ready: boolean;
  /** Step currently in the middle of the viewport. */
  active: number;
  /** Steps that have been active (or scrolled past) at least once. */
  played: readonly boolean[];
}

/**
 * Scroll-driven step sequence. SSR and reduced motion keep `ready` false, so the CSS shows
 * every step complete and static. Steps that are skipped by a fast scroll count as played,
 * so nothing stays hidden.
 */
export function useScrollSteps(count: number): ScrollSteps {
  const listRef = useRef<HTMLOListElement>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [played, setPlayed] = useState<readonly boolean[]>(() => Array(count).fill(false));

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return;
    const steps = Array.from(list.querySelectorAll(":scope > li"));
    const markPlayed = (index: number) =>
      setPlayed((prev) => (prev[index] ? prev : prev.map((v, i) => v || i === index)));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = steps.indexOf(entry.target);
          if (index < 0) continue;
          const bandTop = entry.rootBounds?.top ?? 0;
          if (entry.isIntersecting) {
            setActive(index);
            markPlayed(index);
          } else if (entry.boundingClientRect.bottom <= bandTop) {
            setActive((prev) => Math.max(prev, index));
            markPlayed(index);
          }
        }
      },
      { rootMargin: ACTIVE_BAND_MARGIN },
    );
    for (const step of steps) observer.observe(step);
    setReady(true);
    return () => observer.disconnect();
  }, []);

  return { listRef, ready, active, played };
}
