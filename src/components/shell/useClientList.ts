import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { shellKeys } from "./shellQueries";

export interface ClientSummary {
  id: string;
  name: string;
  instagram_handle: string | null;
  /** Etapa del cliente (prospecto, onboarding, activo, pausado, terminado). */
  status?: string | null;
}

/**
 * Lista liviana de clientes para la paleta ⌘K y el selector del sidebar.
 * staleTime 0: cada apertura (enabled pasa a true) revalida contra Supabase.
 */
export function useClientList(enabled: boolean) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: shellKeys.clients(userId),
    enabled: enabled && Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<ClientSummary[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,instagram_handle,status")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
