import { createFileRoute } from "@tanstack/react-router";
import { SitioPage } from "@/components/site/SitioPage";
import {
  isSitioPagina,
  isSitioTab,
  type SitioPagina,
  type SitioTab,
} from "@/components/site/siteSections";

export interface SitioSearch {
  /** Subsección: resumen (por defecto), secciones, dominio o analitica. */
  tab?: SitioTab;
  /** Página que se edita en las subsecciones con editor: landing (por defecto) o multienlace. */
  pagina?: SitioPagina;
}

/** Enlaces del diseño anterior (`?tab=landing|multienlace`) abren el editor de esa página. */
function parseSearch(s: Record<string, unknown>): SitioSearch {
  if (isSitioTab(s.tab)) {
    return { tab: s.tab, pagina: isSitioPagina(s.pagina) ? s.pagina : undefined };
  }
  if (isSitioPagina(s.tab)) return { tab: "secciones", pagina: s.tab };
  return { tab: undefined, pagina: isSitioPagina(s.pagina) ? s.pagina : undefined };
}

export const Route = createFileRoute("/_app/clients/$clientId/sitio")({
  validateSearch: parseSearch,
  head: () => ({
    meta: [
      { title: "Sitio del cliente | Vibranding" },
      { name: "description", content: "Multienlace y landing page del cliente en un solo lugar." },
      { property: "og:title", content: "Sitio del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Multienlace y landing page del cliente en un solo lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SitioRoute,
});

function SitioRoute() {
  const { clientId } = Route.useParams();
  const { tab, pagina } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <SitioPage
      clientId={clientId}
      tab={tab ?? "resumen"}
      onTabChange={(next) =>
        navigate({
          search: (prev) => ({ ...prev, tab: next === "resumen" ? undefined : next }),
          replace: true,
          resetScroll: false,
        })
      }
      pagina={pagina ?? "landing"}
      onPaginaChange={(next) =>
        navigate({
          search: (prev) => ({ ...prev, pagina: next === "landing" ? undefined : next }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
