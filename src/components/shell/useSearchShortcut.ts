import { useEffect, useState } from "react";
import { isApplePlatform, isEditableTarget } from "./platform";

/**
 * Atajo global (no visible en la UI): ⌘K en Mac, Ctrl+K en el resto. Ignora repeticiones y
 * composición (IME). En campos editables solo responde a ⌘K en Mac, para no pisar Ctrl+K.
 */
export function useSearchShortcut(onToggle: () => void) {
  useEffect(() => {
    const apple = isApplePlatform();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing || e.key.toLowerCase() !== "k") return;
      if (e.altKey || e.shiftKey) return;
      const modifier = apple ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
      if (!modifier) return;
      if (!apple && isEditableTarget(e.target)) return;
      e.preventDefault();
      onToggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onToggle]);
}

/** El atajo sigue activo pero no se muestra; solo se anuncia a lectores (aria-keyshortcuts). */
export function useShortcutKeys(): string {
  const [keys, setKeys] = useState("Meta+K");
  useEffect(() => {
    if (!isApplePlatform()) setKeys("Control+K");
  }, []);
  return keys;
}
