import type { ComponentType, ReactNode } from "react";
import { ErrorState, ListSkeleton } from "@/components/app";
import { cn } from "@/lib/utils";
import type { SectionResult } from "@/lib/portal/model";

export interface PortalSectionProps {
  id: string;
  title: string;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  actions?: ReactNode;
  tone?: "default" | "warning";
  children: ReactNode;
}

const TONE = {
  default: { section: "border-border-subtle bg-surface", icon: "bg-primary/10 text-primary" },
  warning: {
    section: "border-warning/40 bg-warning-subtle",
    icon: "bg-warning/15 text-warning-strong",
  },
} as const;

/**
 * Sección del portal con ancla para la navegación superior. Encabezado propio
 * (más jerarquía que el Panel genérico) y márgenes más angostos en móvil.
 */
export function PortalSection({
  id,
  title,
  description,
  icon: Icon,
  actions,
  tone = "default",
  children,
}: PortalSectionProps) {
  const headingId = `${id}-titulo`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-32 rounded-app-lg border shadow-app-xs", TONE[tone].section)}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 pt-4 sm:px-5 sm:pt-5">
        {Icon && (
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-app-md",
              TONE[tone].icon,
            )}
          >
            <Icon aria-hidden className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2
            id={headingId}
            className="text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg"
          >
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="w-full sm:ml-auto sm:w-auto">{actions}</div>}
      </div>
      <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">{children}</div>
    </section>
  );
}

interface SectionStateProps<T> {
  loading: boolean;
  result: SectionResult<T> | undefined;
  onRetry: () => void;
  retrying: boolean;
  skeletonRows?: number;
  children: (data: T) => ReactNode;
}

/** loading → skeleton · error → reintentar · datos → children. */
export function SectionState<T>({
  loading,
  result,
  onRetry,
  retrying,
  skeletonRows = 3,
  children,
}: SectionStateProps<T>) {
  if (loading || !result) return <ListSkeleton rows={skeletonRows} label="Cargando…" />;
  if (!result.ok)
    return <ErrorState message={result.error} onRetry={onRetry} retrying={retrying} />;
  return <>{children(result.data)}</>;
}
