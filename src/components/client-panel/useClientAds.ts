import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseAdsSummary, type AdsPeriod, type AdsPlatformKey } from "./adsModel";
import { useActiveClientSelf } from "./useClientSelf";

/**
 * Resumen de publicidad del cliente de la sesión (agregados del servidor). El
 * RPC fija el cliente con user_client_id(): no recibe ningún id ni devuelve
 * ids de cuentas, tokens ni la MCC.
 */
export function useClientAds(platform: AdsPlatformKey, days: AdsPeriod) {
  const self = useActiveClientSelf();
  return useQuery({
    queryKey: ["client-panel", self.id, "ads", platform, days],
    staleTime: 5 * 60_000,
    // Al cambiar de período se mantiene la cifra anterior (nunca la de otra plataforma).
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[3] === platform ? prev : undefined),
    queryFn: async () => {
      // Nombres literales: check-aislamiento solo permite RPC client_* conocidos.
      const { data, error } =
        platform === "meta"
          ? await supabase.rpc("client_meta_ads_summary", { _days: days })
          : await supabase.rpc("client_google_ads_summary", { _days: days });
      if (error) {
        console.error(`[client-panel] resumen de ${platform} ads`, error);
        throw new Error("No pudimos cargar tu publicidad.");
      }
      return parseAdsSummary(data, platform);
    },
  });
}
