import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { isLogoSource, type LogoSource } from "@/lib/clients/logo";

export type ClientLogoInfo = { url: string; source: LogoSource | null };

/** Cuelga de ["shell"]: invalidateShellClients también refresca los logos. */
const logosKey = (userId: string) => ["shell", "client-logos", userId] as const;

/** Sin la migración de logos la columna no existe: se muestran iniciales, sin error. */
function isMissingColumn(error: { code?: string }): boolean {
  return error.code === "42703" || error.code === "PGRST204";
}

/**
 * Logos de todos los clientes visibles para el usuario (RLS: su org o, en el
 * portal, su propio cliente). Una sola consulta liviana compartida por la
 * lista, el selector, el buscador, las fichas y el portal.
 */
export function useClientLogos() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: logosKey(userId),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, ClientLogoInfo>> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,logo_url,logo_source")
        .not("logo_url", "is", null);
      if (error) {
        if (isMissingColumn(error)) return new Map();
        throw new Error(error.message);
      }
      return new Map(
        (data ?? [])
          .filter((r) => typeof r.logo_url === "string" && r.logo_url)
          .map((r) => [
            r.id,
            {
              url: r.logo_url as string,
              source: isLogoSource(r.logo_source) ? r.logo_source : null,
            },
          ]),
      );
    },
  });
}

/** Logo de un cliente (null si no tiene o todavía carga). */
export function useClientLogo(clientId: string | null | undefined): ClientLogoInfo | null {
  const logos = useClientLogos();
  return (clientId && logos.data?.get(clientId)) || null;
}

export function invalidateClientLogos(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ["shell", "client-logos"] });
}
