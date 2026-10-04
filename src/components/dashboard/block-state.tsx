import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ErrorState, ListSkeleton } from "@/components/app";

interface BlockStateProps<T> {
  query: UseQueryResult<T>;
  /** Etiqueta para lectores de pantalla mientras carga. */
  loadingLabel: string;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}

/**
 * Patrón de carga por bloque: skeleton → error con reintento → datos.
 * Aísla fallos: si esta query falla, solo este bloque muestra el error.
 */
export function BlockState<T>({ query, loadingLabel, skeleton, children }: BlockStateProps<T>) {
  if (query.isError) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (query.data === undefined) {
    return <>{skeleton ?? <ListSkeleton rows={3} label={loadingLabel} />}</>;
  }
  return <>{children(query.data)}</>;
}
