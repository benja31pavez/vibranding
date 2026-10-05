import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { isPublicSitePath } from "@/lib/analytics/attribution";
import { trackLandingEvent } from "@/lib/track";

/**
 * Registra la visita a cada página pública del sitio de la agencia (home,
 * diagnóstico, servicios, FAQ, legales). Corre solo en el navegador (useEffect),
 * así el SSR nunca cuenta; la deduplicación por sesión vive en trackEvent.
 */
export function SitePageViews() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (isPublicSitePath(pathname)) trackLandingEvent("page_view");
  }, [pathname]);
  return null;
}
