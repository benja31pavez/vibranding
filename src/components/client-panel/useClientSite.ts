import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getClientPanelSite } from "@/lib/client-panel/panel.functions";
import { loadPublicLanding } from "@/lib/site/publicLanding";
import { loadPublicMultilink } from "@/lib/site/publicMultilink";
import { usePanelMode } from "./panelMode";
import { SITE_METRICS_DAYS, parseSiteSummary } from "./siteModel";

const STALE_MS = 5 * 60_000;
const UNAVAILABLE = "Tu sitio aún no está disponible en el panel.";

/**
 * Multienlace y landing del cliente + visitas y clics agregados. Server
 * function sobre la RPC client_site_summary: el cliente lo fija la BD
 * (user_client_id(), o la vista previa validada en servidor).
 */
export function useClientSite() {
  const { user } = useAuth();
  const { preview } = usePanelMode();
  const load = useServerFn(getClientPanelSite);
  return useQuery({
    queryKey: ["client-panel", user?.id ?? "anon", preview ?? "self", "site", SITE_METRICS_DAYS],
    enabled: Boolean(user?.id),
    staleTime: STALE_MS,
    queryFn: async () => {
      const res = await load({ data: preview ? { preview } : {} });
      if (res.status === "unavailable") throw new Error(UNAVAILABLE);
      return res.status === "ok" ? parseSiteSummary(res.data) : null;
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
