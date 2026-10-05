import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useUnmarkedOutcomes } from "@/hooks/use-unmarked-outcomes";
import { AppHeader } from "@/components/shell/AppHeader";
import { ClientSidebar } from "@/components/shell/ClientSidebar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { MobileClientSheet } from "@/components/shell/MobileClientSheet";
import { NOINDEX_META } from "@/lib/site/robots";
import { ShellSkeleton } from "@/components/shell/ShellSkeleton";
import { useShellActiveClient } from "@/components/shell/useShellActiveClient";
import { useUserProfile } from "@/components/shell/useUserProfile";

export const Route = createFileRoute("/_app")({
  // Todo el panel autenticado queda fuera de buscadores; las rutas hijas heredan este meta
  // (si una hija define su propio robots, prevalece la más profunda, siempre con noindex).
  head: () => ({ meta: [NOINDEX_META] }),
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { activeClient, clearActive } = useShellActiveClient(path, session?.user?.id);
  const profile = useUserProfile(session?.user?.id);
  const { stale: unmarkedStale } = useUnmarkedOutcomes(activeClient?.id ?? null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [clientSheetOpen, setClientSheetOpen] = useState(false);
  // Usuario verificado como agencia (no cliente invitado); hasta entonces se muestra el skeleton.
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const togglePalette = useCallback(() => setPaletteOpen((o) => !o), []);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  // Invited client users only have the read-only portal: no mostrar el shell de agencia antes de saberlo.
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.rpc("user_client_id").then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.error("[shell] No se pudo verificar el tipo de usuario", error);
      if (data) {
        navigate({ to: "/portal" });
        return;
      }
      setVerifiedUserId(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, navigate]);

  // Al navegar, cerrar los paneles móviles.
  useEffect(() => {
    setMobileNavOpen(false);
    setClientSheetOpen(false);
  }, [path]);

  if (loading || !session || verifiedUserId !== userId) return <ShellSkeleton />;

  const sidebarProps = {
    activeClient,
    path,
    staleOutcomes: unmarkedStale,
    onDisconnect: clearActive,
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Saltar al contenido
      </a>
      <AppHeader
        path={path}
        user={user}
        profile={profile}
        onSignOut={() => void signOut()}
        onOpenSearch={() => setPaletteOpen(true)}
        mobileNavOpen={mobileNavOpen}
        onMobileNavOpenChange={setMobileNavOpen}
        clientTrigger={
          <MobileClientSheet
            {...sidebarProps}
            open={clientSheetOpen}
            onOpenChange={setClientSheetOpen}
          />
        }
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onToggle={togglePalette} />

      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Panel del cliente"
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col border-r bg-sidebar md:flex"
        >
          <ClientSidebar {...sidebarProps} />
        </aside>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
