import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { ClientSearchEntry } from "@/lib/clients/clientSearch";
import { shellKeys } from "./shellQueries";

/**
 * Índice liviano para el buscador del header: marca, razón social y persona de contacto
 * de los clientes visibles por RLS. Se filtra en el cliente (sin tildes ni mayúsculas).
 */
export function useClientSearchIndex(enabled: boolean) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: shellKeys.clientSearch(userId),
    enabled: enabled && Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<ClientSearchEntry[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,status,client_intake(razon_social,contacto_nombre)")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => {
        const intake = Array.isArray(row.client_intake) ? row.client_intake[0] : row.client_intake;
        return {
          id: row.id,
          brand: row.name,
          legalName: intake?.razon_social?.trim() || null,
          contactName: intake?.contacto_nombre?.trim() || null,
          status: row.status,
        };
      });
    },
  });
}
