const HIGHLIGHT_MS = 1400;

/**
 * Lleva la vista previa a una sección (`data-section`) y la resalta un momento.
 * Hace scroll solo dentro del iframe: `scrollIntoView` también movería los
 * contenedores del panel (que no deben hacer scroll de página).
 */
export function revealPreviewSection(doc: Document | null, key: string): void {
  const el = doc?.querySelector<HTMLElement>(`[data-section="${key}"]`);
  const win = doc?.defaultView;
  if (!el || !win) return;
  const top = el.getBoundingClientRect().top + win.scrollY;
  win.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  el.animate?.(
    [
      { boxShadow: "inset 0 0 0 4px oklch(0.58 0.19 262 / 0.9)" },
      { boxShadow: "inset 0 0 0 4px oklch(0.58 0.19 262 / 0)" },
    ],
    { duration: HIGHLIGHT_MS, easing: "ease-out" },
  );
}
