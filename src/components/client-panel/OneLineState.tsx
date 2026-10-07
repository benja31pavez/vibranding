import type { ComponentType } from "react";

/** Estado de una línea del panel del cliente (vacío o pendiente), sin botones. */
export function OneLineState({
  icon: Icon,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex max-w-md items-center gap-3 rounded-app-lg border border-border-subtle bg-surface px-5 py-4 shadow-app-xs">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-app-md bg-brand-soft text-brand-1">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
