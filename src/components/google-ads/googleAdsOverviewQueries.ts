import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import { getGoogleAdsOverview } from "@/lib/google-ads/connection.functions";

export const googleAdsOverviewKey = (userKey: string, clientId: string) =>
  ["google-ads-overview", userKey, clientId] as const;

/** Configuración y conexión de Google Ads del cliente (compartido por la tarjeta y la página). */
export function useGoogleAdsOverview(clientId: string) {
  const userKey = useUserKey();
  const fetchOverview = useServerFn(getGoogleAdsOverview);
  return useQuery({
    queryKey: googleAdsOverviewKey(userKey, clientId),
    queryFn: () => fetchOverview({ data: { clientId } }),
  });
}

/** ¿Hay métricas de Google Ads ya guardadas para el cliente? (aunque hoy no haya conexión) */
export function useGoogleAdsHasHistory(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: ["google-ads-has-history", userKey, clientId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_ads_insights_daily")
        .select("date")
        .eq("client_id", clientId)
        .limit(1);
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
  });
}
