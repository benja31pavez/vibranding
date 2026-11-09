import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionTab<K extends string = string> {
  key: K;
  label: ReactNode;
  /** Contador opcional (p. ej. tareas por aprobar). */
  badge?: number;
}

export interface SectionTabsProps<K extends string = string> {
  tabs: readonly SectionTab<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Nombre accesible de la barra (p. ej. "Vistas de Proyectos"). */
  label: string;
  className?: string;
}

/**
 * Barra de subsecciones de una pantalla (siempre 4, la primera es "Resumen"): la activa
 * va en azul y termina en flecha, como en el panel de referencia. Es un `tablist`
 * navegable con flechas; el contenido lo decide la pantalla según `value`.
 */
export function SectionTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: SectionTabsProps<K>) {
  const move = (from: number, delta: number) => {
    const next = (from + delta + tabs.length) % tabs.length;
    onChange(tabs[next].key);
    const el = document.getElementById(`section-tab-${String(tabs[next].key)}`);
    el?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex overflow-hidden rounded-app-md border border-border-subtle", className)}
    >
      {tabs.map((t, i) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            id={`section-tab-${String(t.key)}`}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") move(i, 1);
              if (e.key === "ArrowLeft") move(i, -1);
            }}
            className={cn(
              "relative flex h-9 flex-1 items-center justify-center gap-2 px-3 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              active
                ? "section-tab-active z-10 -mr-3 pr-6 text-white"
                : "bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              i > 0 && !active && "border-l border-border-subtle",
            )}
          >
            <span className="truncate">{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-white text-[#2F6BFF]" : "bg-danger-subtle text-danger-strong",
                )}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
