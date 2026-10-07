import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { ErrorState, ListSkeleton } from "@/components/app";
import type { PanelResult } from "@/lib/client-panel/model";

interface PanelQueryLike<T> {
  data: PanelResult<T> | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => unknown;
}

/**
 * Estados comunes de una sección del panel: cargando, error (con Reintentar),
 * "Disponible pronto" (migración sin aplicar) y, si todo está bien, el contenido.
 */
export function PanelSectionState<T>({
  query,
  title,
  skeleton,
  children,
}: {
  query: PanelQueryLike<T>;
  /** "No pudimos cargar tu plan". */
  title: string;
  /** Carga con la forma de la sección (por defecto, filas). */
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return skeleton ?? <ListSkeleton rows={4} label="Cargando" />;
  if (query.isError || query.data?.status === "no_client") {
    return (
      <ErrorState
        title={title}
        message={query.error?.message || "Intenta de nuevo en un momento."}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (!query.data || query.data.status === "unavailable") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock aria-hidden className="h-4 w-4" /> Disponible pronto
      </p>
    );
  }
  return <>{children(query.data.data)}</>;
}
