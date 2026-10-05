import { invalidateMrr } from "@/lib/billing/mrr";
import type { QueryClient } from "@tanstack/react-query";

/** Keys de React Query del shell; todas cuelgan de ["shell"] y se acotan por usuario. */
export const shellKeys = {
  all: ["shell"] as const,
  clients: (userId: string) => ["shell", "clients", userId] as const,
  clientSearch: (userId: string) => ["shell", "client-search", userId] as const,
  client: (userId: string, clientId: string) => ["shell", "client", userId, clientId] as const,
};

/** Llamar tras crear, renombrar o borrar clientes para refrescar header, buscador y sidebar. */
export function invalidateShellClients(queryClient: QueryClient) {
  // Un cliente creado, activado o desactivado cambia también el MRR.
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: shellKeys.all }),
    invalidateMrr(queryClient),
  ]);
}
