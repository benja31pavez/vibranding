import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Lo que el panel muestra de la marca del cliente (columnas seguras de client_self). */
export interface ClientSelf {
  id: string;
  name: string;
  instagramHandle: string | null;
  logoUrl: string | null;
}

/**
 * El cliente del usuario con sesión. Sale SIEMPRE de la vista client_self
 * (WHERE id = user_client_id()), nunca de la URL. null = cuenta sin marca vinculada.
 */
export function useClientSelf(userId: string | undefined) {
  return useQuery({
    queryKey: ["client-panel", userId ?? "anon", "self"],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ClientSelf | null> => {
      const { data, error } = await supabase
        .from("client_self")
        .select("id,name,instagram_handle,logo_url")
        .maybeSingle();
      if (error) {
        console.error("[client-panel] No se pudo leer client_self", error);
        throw new Error("No pudimos cargar los datos de tu marca.");
      }
      if (!data?.id) return null;
      return {
        id: data.id,
        name: data.name ?? "Tu marca",
        instagramHandle: data.instagram_handle,
        logoUrl: data.logo_url,
      };
    },
  });
}

const ClientSelfContext = createContext<ClientSelf | null>(null);

export const ClientSelfProvider = ClientSelfContext.Provider;

/**
 * Cliente de la sesión para las páginas del panel. Si una página reutiliza un
 * componente que pide clientId, se lo pasa desde aquí (nunca desde la URL).
 */
export function useActiveClientSelf(): ClientSelf {
  const self = useContext(ClientSelfContext);
  if (!self) throw new Error("useActiveClientSelf fuera del panel del cliente");
  return self;
}
