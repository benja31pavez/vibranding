import type { QueryClient } from "@tanstack/react-query";

/** Keys de React Query de "Salud del cliente", acotadas por usuario. */
export const healthKeys = {
  all: ["client-health"] as const,
  scope: (userId: string, clientId: string | null) =>
    ["client-health", userId, clientId ?? "all"] as const,
};

/** Recalcula la salud (lista, ficha y "Hoy") tras un cambio que la afecta. */
export function invalidateClientHealth(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: healthKeys.all });
}
