import { useCallback, useRef } from "react";
import { prefersReducedMotion } from "./use-motion";

/** Max tilt in degrees on each axis. */
const MAX_TILT_DEG = 5;

/**
 * Pointer handlers for a subtle 3D tilt (mouse only, skipped with reduced motion). Writes
 * `--rx` / `--ry` on the element in an animation frame; the CSS turns them into a transform.
 */
export function useTilt() {
  const frame = useRef(0);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || prefersReducedMotion()) return;
    const el = event.currentTarget;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width - 0.5;
      const y = (clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty("--rx", `${(-y * MAX_TILT_DEG * 2).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(x * MAX_TILT_DEG * 2).toFixed(2)}deg`);
    });
  }, []);

  const onPointerLeave = useCallback((event: React.PointerEvent<HTMLElement>) => {
    cancelAnimationFrame(frame.current);
    event.currentTarget.style.removeProperty("--rx");
    event.currentTarget.style.removeProperty("--ry");
  }, []);

  return { onPointerMove, onPointerLeave };
}
