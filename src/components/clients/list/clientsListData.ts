import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { compareByRisk, type ClientHealth, type HealthLevel } from "@/lib/health";

export interface ClientListItem {
  id: string;
  name: string;
  instagram_handle: string | null;
  notes: string | null;
  updated_at: string;
}

export type SortMode = "recent" | "risk";
export type LevelFilter = HealthLevel | "all";

export const SORT_LABEL: Readonly<Record<SortMode, string>> = {
  recent: "Recientes",
  risk: "En riesgo primero",
};

export const clientsListKey = (userId: string) => ["clients-list", userId] as const;

/** Clientes del usuario (RLS), del más reciente al más antiguo. */
export function useClientsList() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: clientsListKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ClientListItem[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,instagram_handle,notes,updated_at")
        .order("updated_at", { ascending: false });
      if (error) {
        console.error("[clients] error al cargar", error);
        throw new Error(error.message);
      }
      return data ?? [];
    },
  });
}

export function invalidateClientsList(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ["clients-list"] });
}

/** Ordena/filtra sin mutar la lista original. */
export function arrangeClients(
  clients: readonly ClientListItem[],
  health: ReadonlyMap<string, ClientHealth> | undefined,
  sort: SortMode,
  level: LevelFilter,
): ClientListItem[] {
  // Sin datos de salud (cargando o error) el filtro no aplica.
  const filtered =
    level === "all" || !health
      ? [...clients]
      : clients.filter((c) => health.get(c.id)?.level === level);
  if (sort !== "risk" || !health) return filtered;
  return filtered.sort((a, b) => compareByRisk(health.get(a.id), health.get(b.id)));
}
