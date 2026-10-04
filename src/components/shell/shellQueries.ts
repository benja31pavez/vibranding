import type { QueryClient } from "@tanstack/react-query";

/** Keys de React Query del shell; todas cuelgan de ["shell"] y se acotan por usuario. */
export const shellKeys = {
  all: ["shell"] as const,
  clients: (userId: string) => ["shell", "clients", userId] as const,
  client: (userId: string, clientId: string) => ["shell", "client", userId, clientId] as const,
};

/** Llamar tras crear, renombrar o borrar clientes para refrescar header, ⌘K y sidebar. */
export function invalidateShellClients(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: shellKeys.all });
}
