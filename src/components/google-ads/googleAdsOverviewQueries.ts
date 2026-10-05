import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
