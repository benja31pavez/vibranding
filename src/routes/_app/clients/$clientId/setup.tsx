import { createFileRoute } from "@tanstack/react-router";
import { ErrorState, FitPage, ListSkeleton } from "@/components/app";
import { ConnectionDetail } from "@/components/setup/ConnectionDetail";
import { ConnectionsSummary } from "@/components/setup/ConnectionsSummary";
import { parseConnectionKey, type ConnectionKey } from "@/components/setup/connectionModel";
import { useConnections } from "@/components/setup/useConnections";

const DESCRIPTION =
  "Instagram, WhatsApp, Meta Ads y Google Ads del cliente, cada una por separado.";

export const Route = createFileRoute("/_app/clients/$clientId/setup")({
  // ?conexion=instagram|whatsapp|meta-ads|google-ads abre esa conexión; sin él, el resumen.
  validateSearch: (s: Record<string, unknown>): { conexion?: ConnectionKey } => ({
    conexion: parseConnectionKey(s.conexion),
  }),
  head: () => ({
    meta: [
      { title: "Conexiones | Vibranding" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Conexiones | Vibranding" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const { clientId } = Route.useParams();
  const { conexion } = Route.useSearch();
  const state = useConnections(clientId);

  if (state.loadError) {
    return (
      <FitPage scroll>
        <ErrorState
          title="No pudimos cargar las conexiones del cliente"
          message={state.loadError.message}
          onRetry={() =>
            void Promise.all([
              state.status.refetch(),
              state.capsState.reload(),
              state.plan.refetch(),
            ])
          }
          retrying={state.status.isFetching}
        />
      </FitPage>
    );
  }
  if (state.loading) {
    return (
      <FitPage scroll>
        <ListSkeleton rows={4} label="Cargando conexiones" />
      </FitPage>
    );
  }

  if (!conexion) {
    return <ConnectionsSummary clientId={clientId} connections={state.connections} />;
  }
  // key: al cambiar de conexión se vuelve a elegir su primer paso pendiente.
  return (
    <ConnectionDetail
      key={conexion}
      clientId={clientId}
      info={state.connections[conexion]}
      state={state}
    />
  );
}
