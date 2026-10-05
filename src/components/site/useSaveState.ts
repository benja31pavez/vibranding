import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveState } from "@/components/site/SaveStatus";

type Phase = "idle" | "saving" | "saved" | "error";

/** Muestra "Guardado" unos segundos y luego vuelve a reposo. */
const SAVED_FLASH_MS = 2500;

/**
 * Estado de guardado de un editor con borrador: combina la fase del último
 * guardado con si hay cambios pendientes.
 */
export function useSaveState(dirty: boolean) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const start = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setPhase("saving");
    setDetail(null);
  }, []);

  const succeed = useCallback(() => {
    setPhase("saved");
    setDetail(null);
    timer.current = setTimeout(() => setPhase("idle"), SAVED_FLASH_MS);
  }, []);

  const fail = useCallback((message: string) => {
    setPhase("error");
    setDetail(message);
  }, []);

  const state: SaveState =
    phase === "saving"
      ? "saving"
      : phase === "error"
        ? "error"
        : dirty
          ? "dirty"
          : phase === "saved"
            ? "saved"
            : "idle";

  return {
    state,
    detail: phase === "error" ? detail : null,
    saving: phase === "saving",
    start,
    succeed,
    fail,
  };
}
