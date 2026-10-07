import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getClientPanelAds } from "@/lib/client-panel/panel.functions";
import { parseAdsSummary, type AdsPeriod, type AdsPlatformKey } from "./adsModel";
import { usePanelMode } from "./panelMode";

const UNAVAILABLE = "Tu publicidad aún no está disponible en el panel.";

/**
 * Resumen de publicidad (agregados del servidor). Server function sobre las
 * RPC client_meta_ads_summary / client_google_ads_summary: el cliente lo fija
 * la BD y no se devuelven ids de cuentas, tokens ni la MCC.
 */
export function useClientAds(platform: AdsPlatformKey, days: AdsPeriod) {
  const { user } = useAuth();
  const { preview } = usePanelMode();
  const load = useServerFn(getClientPanelAds);
  return useQuery({
    queryKey: ["client-panel", user?.id ?? "anon", preview ?? "self", "ads", platform, days],
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    // Al cambiar de período se mantiene la cifra anterior (nunca la de otra plataforma).
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[4] === platform ? prev : undefined),
    queryFn: async () => {
      const res = await load({ data: { ...(preview ? { preview } : {}), platform, days } });
      if (res.status === "unavailable") throw new Error(UNAVAILABLE);
      return res.status === "ok" ? parseAdsSummary(res.data, platform) : null;
    },
  });
}
