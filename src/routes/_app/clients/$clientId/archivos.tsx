import { createFileRoute } from "@tanstack/react-router";
import {
  ArchivosPage,
  isArchivosTab,
  type ArchivosTab,
} from "@/components/clients/archivos/ArchivosPage";

interface ArchivosSearch {
  /** Subsección de Archivos: resumen (por defecto), carpetas, recientes o compartidos. */
  tab?: ArchivosTab;
}

/** Archivos del cliente: piezas gráficas y documentos generados, y lo que subió el cliente. */
export const Route = createFileRoute("/_app/clients/$clientId/archivos")({
  validateSearch: (s: Record<string, unknown>): ArchivosSearch => ({
    tab: isArchivosTab(s.tab) ? s.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Archivos del cliente | Vibranding" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ArchivosRoute,
});

function ArchivosRoute() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ArchivosPage
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
