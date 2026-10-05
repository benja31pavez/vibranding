import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { compareByRisk, type ClientHealth, type HealthLevel } from "@/lib/health";
import { isClientStatus, type ClientStatus } from "@/components/clients/ficha/fichaQueries";

export interface ClientListItem {
  id: string;
  name: string;
  instagram_handle: string | null;
  notes: string | null;
  /** Etapa comercial (`clients.status`): prospecto, onboarding, activo, pausado, terminado. */
  status: string;
  updated_at: string;
}

export type SortMode = "recent" | "risk";
export type LevelFilter = HealthLevel | "all";
export type StageFilter = ClientStatus | "all";

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
        .select("id,name,instagram_handle,notes,status,updated_at")
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
  stage: StageFilter = "all",
): ClientListItem[] {
  const byStage = stage === "all" ? clients : clients.filter((c) => c.status === stage);
  // Sin datos de salud (cargando o error) el filtro de salud no aplica.
  const filtered =
    level === "all" || !health
      ? [...byStage]
      : byStage.filter((c) => health.get(c.id)?.level === level);
  if (sort !== "risk" || !health) return filtered;
  return filtered.sort((a, b) => compareByRisk(health.get(a.id), health.get(b.id)));
}

export interface PortfolioSummary {
  /** Clientes por etapa comercial (las etapas desconocidas no se cuentan). */
  byStage: Readonly<Record<ClientStatus, number>>;
  /** Clientes puntuados en riesgo / en atención (null mientras no hay datos de salud). */
  enRiesgo: number | null;
  atencion: number | null;
}

/** Cifras de la cartera para la franja de KPIs de la lista. */
export function summarizePortfolio(
  clients: readonly ClientListItem[],
  health: ReadonlyMap<string, ClientHealth> | undefined,
): PortfolioSummary {
  const byStage: Record<ClientStatus, number> = {
    prospecto: 0,
    onboarding: 0,
    activo: 0,
    pausado: 0,
    terminado: 0,
  };
  let enRiesgo = 0;
  let atencion = 0;
  for (const c of clients) {
    if (isClientStatus(c.status)) byStage[c.status] += 1;
    const level = health?.get(c.id)?.level;
    if (level === "en_riesgo") enRiesgo += 1;
    else if (level === "atencion") atencion += 1;
  }
  return {
    byStage,
    enRiesgo: health ? enRiesgo : null,
    atencion: health ? atencion : null,
  };
}
