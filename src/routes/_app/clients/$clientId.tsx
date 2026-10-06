import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientProvider, useActiveClient } from "@/contexts/ActiveClientContext";
import { EmptyState, ErrorState, ListSkeleton, PAGE_CONTAINER_CLASS } from "@/components/app";
import { Button } from "@/components/ui/button";
import { fichaKeys, useUserKey } from "@/components/clients/ficha/fichaQueries";

export const Route = createFileRoute("/_app/clients/$clientId")({
  component: ClientLayout,
});

function ClientLayout() {
  const { clientId } = Route.useParams();
  return (
    <ClientProvider clientId={clientId}>
      <ClientShell />
    </ClientProvider>
  );
}

const SHELL_CLASS = PAGE_CONTAINER_CLASS;

/**
 * Contenedor de las pantallas de un cliente. Verifica que el cliente exista (o sea
 * visible para el usuario) antes de renderizar, para no quedar en "Cargando…" infinito.
 */
function ClientShell() {
  const { clientId } = Route.useParams();
  const { client, reloadClient, clientError } = useActiveClient();
  const userKey = useUserKey();
  const matchRoute = useMatchRoute();
  const fitsScreen = Boolean(
    matchRoute({ to: "/clients/$clientId/plan", params: { clientId } }) ||
    matchRoute({ to: "/clients/$clientId/ficha", params: { clientId } }) ||
    matchRoute({ to: "/clients/$clientId/archivos", params: { clientId } }) ||
    matchRoute({ to: "/clients/$clientId/setup", params: { clientId } }) ||
    matchRoute({ to: "/clients/$clientId/facturacion", params: { clientId } }) ||
    matchRoute({ to: "/clients/$clientId", params: { clientId } }),
  );
  const existence = useQuery({
    queryKey: fichaKeys.exists(userKey, clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data !== null;
    },
  });

  if (existence.error || clientError) {
    return (
      <div className={SHELL_CLASS}>
        <ErrorState
          title="No pudimos cargar este cliente"
          message={existence.error?.message ?? clientError ?? undefined}
          onRetry={() => {
            void existence.refetch();
            void reloadClient();
          }}
          retrying={existence.isFetching}
        />
      </div>
    );
  }

  if (existence.data === false) {
    return (
      <div className={SHELL_CLASS}>
        <EmptyState
          icon={UserX}
          title="Cliente no encontrado"
          description="Puede que haya sido eliminado o que no tengas acceso a él."
          action={
            <Button asChild size="sm">
              <Link to="/clients">Ver todos los clientes</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // El contexto puede traer aún el cliente anterior al navegar entre clientes.
  if (existence.isLoading || !client || client.id !== clientId) {
    return (
      <div className={SHELL_CLASS}>
        <ListSkeleton rows={4} label="Cargando cliente" />
      </div>
    );
  }

  // Pantallas ya adaptadas a "una pantalla": usan su propio FitPage (alto completo, sin scroll).
  if (fitsScreen) {
    return (
      <div className="flex min-h-0 flex-col md:h-full">
        <Outlet key={clientId} />
      </div>
    );
  }

  return (
    <div className={SHELL_CLASS}>
      {/* key: remonta las pantallas al cambiar de cliente para no arrastrar estado local. */}
      <Outlet key={clientId} />
    </div>
  );
}
