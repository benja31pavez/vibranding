import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadPublicLanding } from "@/lib/site/publicLanding";
import { loadPublicMultilink } from "@/lib/site/publicMultilink";
import { SITE_METRICS_DAYS, parseSiteSummary } from "./siteModel";
import { useActiveClientSelf } from "./useClientSelf";

const STALE_MS = 5 * 60_000;

/**
 * Multienlace y landing del cliente de la sesión + visitas y clics agregados.
 * El RPC fija el cliente con user_client_id(): no recibe ningún id.
 */
export function useClientSite() {
  const self = useActiveClientSelf();
  return useQuery({
    queryKey: ["client-panel", self.id, "site", SITE_METRICS_DAYS],
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("client_site_summary", {
        _days: SITE_METRICS_DAYS,
      });
      if (error) {
        console.error("[client-panel] client_site_summary", error);
        throw new Error("No pudimos cargar tu sitio.");
      }
      return parseSiteSummary(data);
    },
  });
}

/** null si la página ya no está publicada (el loader público lanza notFound). */
async function orNull<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (e) {
    if (e instanceof Error) throw e;
    return null;
  }
}

/** Contenido público del multienlace (el mismo loader que /l/$slug). */
export function usePublicMultilink(slug: string | null) {
  return useQuery({
    queryKey: ["client-panel", "public-multilink", slug],
    enabled: Boolean(slug),
    staleTime: STALE_MS,
    queryFn: () => orNull(() => loadPublicMultilink(slug ?? "")),
  });
}

/** Contenido público de la landing (el mismo loader que /@slug). */
export function usePublicLanding(slug: string | null) {
  return useQuery({
    queryKey: ["client-panel", "public-landing", slug],
    enabled: Boolean(slug),
    staleTime: STALE_MS,
    queryFn: () => orNull(() => loadPublicLanding(slug ?? "")),
  });
}
