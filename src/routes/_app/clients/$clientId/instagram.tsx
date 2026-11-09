import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  InstagramSectionPage,
  isInstagramTab,
  type InstagramTab,
} from "@/components/instagram/InstagramSectionPage";

interface InstagramSearch {
  /** Subsección: resumen (por defecto), publicaciones, audiencia o mensajes. */
  tab?: InstagramTab;
  /** Pestañas antiguas que se redirigen en `beforeLoad`. */
  legacy?: "calendario" | "automatizacion";
}

/** Pestañas del diseño anterior: los enlaces viejos siguen funcionando. */
const LEGACY_TABS: Record<string, InstagramTab> = {
  grid: "publicaciones",
  engagement: "audiencia",
};

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
  },
  head: () => ({
    meta: [
      { title: "Instagram del cliente | Vibranding" },
      {
        name: "description",
        content: "Resumen, publicaciones, audiencia y mensajes de Instagram del cliente.",
      },
      { property: "og:title", content: "Instagram del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Resumen, publicaciones, audiencia y mensajes de Instagram del cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstagramRoute,
});

function InstagramRoute() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <InstagramSectionPage
      clientId={clientId}
      tab={tab ?? "resumen"}
      onTabChange={(next) =>
        navigate({
          search: () => ({ tab: next === "resumen" ? undefined : next }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
