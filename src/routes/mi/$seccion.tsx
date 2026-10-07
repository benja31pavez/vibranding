import { createFileRoute, redirect } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/client-panel/ComingSoonPage";
import { soonSection } from "@/components/client-panel/sections";

/**
 * Secciones del panel cuya lectura se abre en la Fase 2 ("Disponible pronto").
 * El parámetro es el NOMBRE de la sección (nunca un clientId); cualquier otro
 * valor vuelve al Resumen. Cuando una sección tenga página propia
 * (src/routes/mi/<clave>.tsx), esa ruta estática tiene prioridad.
 */
export const Route = createFileRoute("/mi/$seccion")({
  beforeLoad: ({ params }) => {
    if (!soonSection(params.seccion)) throw redirect({ to: "/mi" });
  },
  component: SoonRoute,
});

function SoonRoute() {
  const { seccion } = Route.useParams();
  const section = soonSection(seccion);
  return section ? <ComingSoonPage section={section} /> : null;
}
