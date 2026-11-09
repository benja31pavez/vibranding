import { createFileRoute } from "@tanstack/react-router";
import { AnunciosPage, isAnunciosTab, type AnunciosTab } from "@/components/anuncios/AnunciosPage";

interface AnunciosSearch {
  /** Subsección de Anuncios: resumen (por defecto), meta, google o configuracion. */
  tab?: AnunciosTab;
  /** Avisos que dejan los callbacks de OAuth de Meta y Google en la URL. */
  meta?: string;
  meta_error?: string;
  gads?: string;
  gads_error?: string;
}

export const Route = createFileRoute("/_app/clients/$clientId/anuncios")({
  validateSearch: (s: Record<string, unknown>): AnunciosSearch => ({
    tab: isAnunciosTab(s.tab) ? s.tab : undefined,
    meta: typeof s.meta === "string" ? s.meta : undefined,
    meta_error: typeof s.meta_error === "string" ? s.meta_error : undefined,
    gads: typeof s.gads === "string" ? s.gads : undefined,
    gads_error: typeof s.gads_error === "string" ? s.gads_error : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Anuncios del cliente | Vibranding" },
      {
        name: "description",
        content: "Meta Ads, Google Ads y configuración común en una sola pantalla.",
      },
      { property: "og:title", content: "Anuncios del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Meta Ads, Google Ads y configuración común en una sola pantalla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnunciosRoute,
});

function AnunciosRoute() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AnunciosPage
      clientId={clientId}
      tab={tab ?? "resumen"}
      onTabChange={(next) =>
        navigate({
          search: (prev) => ({
            ...prev,
            tab: next === "resumen" ? undefined : next,
          }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
