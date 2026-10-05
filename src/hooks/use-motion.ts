import { useEffect, useState } from "react";

const REVEAL_SELECTOR = "[data-reveal],[data-reveal-stagger]";
/** Elements whose top is above this fraction of the viewport stay visible (no flash on load). */
const FOLD_RATIO = 0.9;
const REVEAL_ROOT_MARGIN = "0px 0px -8% 0px";
const SCROLLED_OFFSET_PX = 8;

export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Scroll reveal for `[data-reveal]` (single element) and `[data-reveal-stagger]` (children
 * one after another). SSR-safe: the server HTML is fully visible; only elements below the fold
 * are hidden, and only after hydration, when the observer is already watching them.
 * Each element reveals once. Skipped entirely with prefers-reduced-motion.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return;

    const fold = window.innerHeight * FOLD_RATIO;
    const pending = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)).filter(
      (el) => el.getBoundingClientRect().top > fold,
    );
    if (pending.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.setAttribute("data-revealed", "");
          observer.unobserve(el);
        }
      },
      { rootMargin: REVEAL_ROOT_MARGIN },
    );
    for (const el of pending) {
      el.setAttribute("data-reveal-pending", "");
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      for (const el of pending) {
        el.removeAttribute("data-reveal-pending");
        el.removeAttribute("data-revealed");
      }
    };
  }, []);
}

/** True once the page has scrolled past a few pixels (for the solid header state). */
export function useScrolled(offset = SCROLLED_OFFSET_PX): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [offset]);
  return scrolled;
}
