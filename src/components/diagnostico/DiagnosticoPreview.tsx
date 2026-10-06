import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/hooks/use-motion";
import { vars } from "@/components/home/mockups/tokens";

/**
 * "Así se ve tu diagnóstico": an illustrative example (no real client data, no scores) with the
 * three pillars from the home. The server HTML is the finished static frame; after hydration the
 * bars are hidden until the card scrolls into view, then fill in (diagnostico.css). Skipped with
 * prefers-reduced-motion.
 */

const PILLARS = [
  { label: "Te encuentran", note: "Google y búsquedas", level: "38%" },
  { label: "Te eligen", note: "Marca e Instagram", level: "64%" },
  { label: "Te compran", note: "Web y WhatsApp", level: "52%" },
] as const;

const PRIORITY = "completar tu ficha de Google para que te encuentren";
const VIEW_ROOT_MARGIN = "0px 0px -10% 0px";

function usePlayOnView() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return;

    el.setAttribute("data-dx-pending", "");
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        el.setAttribute("data-dx-play", "");
        observer.disconnect();
      },
      { rootMargin: VIEW_ROOT_MARGIN },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.removeAttribute("data-dx-pending");
      el.removeAttribute("data-dx-play");
    };
  }, []);
  return ref;
}

export function DiagnosticoPreview() {
  const ref = usePlayOnView();

  return (
    <figure
      ref={ref}
      className="dx-preview rounded-2xl border bg-card p-4 shadow-sm md:p-5"
      aria-label="Ejemplo ilustrativo de cómo se ve un diagnóstico"
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Así se ve tu diagnóstico</span>
        <span className="rounded-full border px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
          Ejemplo
        </span>
      </figcaption>
      <ul className="mt-4 space-y-3">
        {PILLARS.map((pillar, index) => (
          <li key={pillar.label}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{pillar.label}</span>
              <span className="text-xs text-muted-foreground">{pillar.note}</span>
            </div>
            <span
              aria-hidden
              className="mt-1.5 block h-2 overflow-hidden rounded-full bg-foreground/10"
            >
              <span
                className="dx-fill block h-full rounded-full bg-gradient-brand"
                style={{ width: pillar.level, ...vars({ "--i": index }) }}
              />
            </span>
          </li>
        ))}
      </ul>
      <p className="dx-priority mt-4 rounded-xl bg-secondary px-3 py-2 text-sm">
        <span className="font-semibold">Prioridad 1:</span> {PRIORITY}
      </p>
    </figure>
  );
}
