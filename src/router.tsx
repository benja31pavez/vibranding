import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Evita refetch inmediato al montar/volver a una vista ya cargada; las mutaciones siguen invalidando.
        staleTime: 30_000,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // En escritorio el panel interno hace scroll dentro de <main> (AppShellFrame), no en la ventana.
    scrollToTopSelectors: ["#main"],
    defaultPreloadStaleTime: 0,
  });

  return router;
};
