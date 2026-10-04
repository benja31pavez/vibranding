import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientSummary {
  id: string;
  name: string;
  instagram_handle: string | null;
}

const CLIENT_LIST_STALE_MS = 60_000;

/** Lista liviana de clientes para la paleta ⌘K y el selector del sidebar. */
export function useClientList(enabled: boolean) {
  return useQuery({
    queryKey: ["shell", "clients"],
    enabled,
    staleTime: CLIENT_LIST_STALE_MS,
    queryFn: async (): Promise<ClientSummary[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,instagram_handle")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
