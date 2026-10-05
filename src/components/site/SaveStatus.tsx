import { useEffect } from "react";
import { useBlocker } from "@tanstack/react-router";
import { AlertCircle, Check, Loader2, CircleDot } from "lucide-react";
import { ConfirmDialog } from "@/components/app";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const STATE_UI: Record<SaveState, { label: string; className: string }> = {
  idle: { label: "Todo guardado", className: "text-muted-foreground" },
  dirty: { label: "Cambios sin guardar", className: "text-amber-700 dark:text-amber-400" },
  saving: { label: "Guardando…", className: "text-muted-foreground" },
  saved: { label: "Guardado", className: "text-emerald-700 dark:text-emerald-400" },
  error: { label: "Error al guardar", className: "text-destructive" },
};

/** Indicador de guardado visible y anunciado a lectores de pantalla. */
export function SaveStatus({ state, detail }: { state: SaveState; detail?: string | null }) {
  const ui = STATE_UI[state];
  const Icon =
    state === "saving"
      ? Loader2
      : state === "error"
        ? AlertCircle
        : state === "dirty"
          ? CircleDot
          : Check;
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 text-sm ${ui.className}`}
    >
      <Icon
        className={`w-4 h-4 shrink-0 ${state === "saving" ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      <span>{ui.label}</span>
      {detail && (
        <span className="text-xs text-muted-foreground truncate max-w-[16rem]">· {detail}</span>
      )}
    </span>
  );
}

/**
 * Avisa antes de salir con cambios sin guardar: cierre de pestaña (beforeunload)
 * y navegación interna a otra ruta. Cambiar entre pestañas de la misma página
 * (sólo cambia ?tab=) no bloquea.
 */
export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => dirty && current.pathname !== next.pathname,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  });

  return (
    <ConfirmDialog
      open={blocker.status === "blocked"}
      onOpenChange={(open) => {
        if (!open && blocker.status === "blocked") blocker.reset();
      }}
      title="Tienes cambios sin guardar"
      description="Si sales ahora, los cambios que no guardaste se pierden."
      confirmLabel="Salir sin guardar"
      cancelLabel="Seguir editando"
      destructive
      onConfirm={() => blocker.proceed?.()}
    />
  );
}

/**
 * Cmd/Ctrl + S guarda. `rootRef` evita que el editor de una pestaña oculta
 * (montada con forceMount) también guarde.
 */
export function useSaveShortcut(
  onSave: () => void,
  enabled: boolean,
  rootRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        if (!rootRef.current || rootRef.current.offsetParent === null) return;
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, enabled, rootRef]);
}
