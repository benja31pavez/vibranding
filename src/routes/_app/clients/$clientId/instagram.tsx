import { createFileRoute, redirect } from "@tanstack/react-router";
import { isInstagramTab, type InstagramTab } from "@/components/instagram/InstagramSectionPage";

interface InstagramSearch {
  /** Compatibilidad con enlaces antiguos: subpestaña de Instagram. */
  tab?: InstagramTab;
  /** Pestañas del diseño aún más antiguo. */
  legacy?: "calendario" | "automatizacion";
}

/** Pestañas del diseño anterior: los enlaces viejos siguen funcionando. */
const LEGACY_TABS: Record<string, InstagramTab> = {
  grid: "publicaciones",
  engagement: "audiencia",
};

/**
 * Ruta antigua: Instagram ahora es una subpestaña dentro de Canales (`/canales?tab=instagram`).
 * Se preservan los enlaces viejos redirigiendo al nuevo destino, con la subpestaña interna
 * trasladada al search param `igsub`.
 */
export const Route = createFileRoute("/_app/clients/$clientId/instagram")({
  validateSearch: (s: Record<string, unknown>): InstagramSearch => ({
    tab: isInstagramTab(s.tab)
      ? s.tab
      : typeof s.tab === "string" && LEGACY_TABS[s.tab]
        ? LEGACY_TABS[s.tab]
        : undefined,
    legacy:
      s.tab === "calendario"
        ? "calendario"
        : s.tab === "automatizacion" || s.tab === "automation"
          ? "automatizacion"
          : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    // El calendario de contenido y la automatización viven en sus propias secciones.
    if (search.legacy === "automatizacion") {
      throw redirect({
        to: "/clients/$clientId/automatizacion",
        params,
        search: { tab: "comentarios" },
      });
    }
    if (search.legacy === "calendario") {
      throw redirect({ to: "/clients/$clientId/calendario", params, search: {} });
    }
    // Redirección permanente a Canales con Instagram seleccionado.
    throw redirect({
      to: "/clients/$clientId/canales",
      params,
      search: { tab: "instagram", igsub: search.tab },
    });
  },
});
