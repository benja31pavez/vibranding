import type { ComponentType, ReactNode } from "react";
import { ErrorState, ListSkeleton, Panel } from "@/components/app";
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

/** Sección del portal con ancla para la navegación superior. */
export function PortalSection({ id, children, ...panel }: PortalSectionProps) {
  return (
    <div id={id} className="scroll-mt-28">
      <Panel {...panel}>{children}</Panel>
    </div>
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
