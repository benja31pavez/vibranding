/** Inline CSS custom properties (e.g. `--i` for the stagger index of `.mk-loop`). */
export function vars(values: Record<string, string | number>): React.CSSProperties {
  return values as React.CSSProperties;
}

/** Brand-tinted gradients for fake posts, ads and thumbnails. */
export const SWATCHES = [
  "linear-gradient(135deg, var(--brand-1), var(--brand-2))",
  "linear-gradient(160deg, var(--brand-3), var(--brand-2))",
  "linear-gradient(200deg, var(--brand-2), color-mix(in oklab, var(--brand-1) 70%, black))",
  "linear-gradient(135deg, color-mix(in oklab, var(--brand-1) 60%, white), var(--brand-1))",
  "linear-gradient(135deg, var(--brand-3), color-mix(in oklab, var(--brand-3) 55%, var(--brand-1)))",
  "linear-gradient(135deg, color-mix(in oklab, var(--brand-2) 55%, white), var(--brand-2))",
] as const;
