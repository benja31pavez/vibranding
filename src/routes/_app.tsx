import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { forgetUserKind, resolveUserKind } from "@/lib/auth/userKind";
import { useUnmarkedOutcomes } from "@/hooks/use-unmarked-outcomes";
import { useSyncLanguagePref } from "@/hooks/use-user-prefs";
import { AppHeader } from "@/components/shell/AppHeader";
import { AppShellFrame } from "@/components/shell/AppShellFrame";
import { ClientSidebar } from "@/components/shell/ClientSidebar";
import { HeaderSearch } from "@/components/shell/HeaderSearch";
import { MobileClientSheet } from "@/components/shell/MobileClientSheet";
import { NOINDEX_META } from "@/lib/site/robots";
import { ShellSkeleton } from "@/components/shell/ShellSkeleton";
import { useShellActiveClient } from "@/components/shell/useShellActiveClient";
import { useUserProfile } from "@/components/shell/useUserProfile";

export const Route = createFileRoute("/_app")({
  // Todo el panel autenticado queda fuera de buscadores; las rutas hijas heredan este meta
  // (si una hija define su propio robots, prevalece la más profunda, siempre con noindex).
  head: () => ({ meta: [NOINDEX_META] }),
  // Guard de todas las rutas de agencia (hijas de /_app): un usuario cliente va a /portal.
  // En SSR no hay sesión (vive en el navegador): ahí decide AppLayout al hidratar.
  // Si la verificación falla, lanza → errorComponent de la raíz (nunca el shell de agencia).
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return; // AppLayout redirige a /login.
    if ((await resolveUserKind(userId)) === "client") throw redirect({ to: "/portal" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { activeClient } = useShellActiveClient(path, session?.user?.id);
  const profile = useUserProfile(session?.user?.id);
  // Idioma guardado en Preferencias → sitio público (el panel sigue en español).
  useSyncLanguagePref();
  const { stale: unmarkedStale } = useUnmarkedOutcomes(activeClient?.id ?? null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [clientSheetOpen, setClientSheetOpen] = useState(false);
  // Usuario verificado como agencia (no cliente invitado); hasta entonces se muestra el skeleton.
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  // Falla cerrado: si no se pudo verificar, no se muestra el shell de agencia.
  const [kindError, setKindError] = useState<string | null>(null);
  const [kindAttempt, setKindAttempt] = useState(0);
  const toggleSearch = useCallback(() => setSearchOpen((o) => !o), []);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  // Invited client users only have the read-only portal: no mostrar el shell de agencia antes de saberlo.
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setKindError(null);
    resolveUserKind(userId).then(
      (kind) => {
        if (cancelled) return;
        if (kind === "client") {
          navigate({ to: "/portal" });
          return;
        }
        setVerifiedUserId(userId);
      },
      (e: unknown) => {
        if (cancelled) return;
        setKindError(e instanceof Error ? e.message : "No pudimos verificar tu cuenta.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId, navigate, kindAttempt]);

  // Al navegar, cerrar los paneles móviles.
  useEffect(() => {
    setMobileNavOpen(false);
    setClientSheetOpen(false);
  }, [path]);

  if (kindError && userId && verifiedUserId !== userId) {
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-center"
      >
        <p className="max-w-sm text-sm text-muted-foreground">{kindError}</p>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              forgetUserKind(userId);
              setKindAttempt((n) => n + 1);
            }}
          >
            Reintentar
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Salir
          </Button>
        </div>
      </div>
    );
  }
  if (loading || !session || verifiedUserId !== userId) return <ShellSkeleton />;

  const sidebarProps = {
    activeClient,
    path,
    staleOutcomes: unmarkedStale,
  };

  return (
    <AppShellFrame
      header={
        <AppHeader
          path={path}
          user={user}
          profile={profile}
          onSignOut={() => void signOut()}
          search={
            <HeaderSearch open={searchOpen} onOpenChange={setSearchOpen} onToggle={toggleSearch} />
          }
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
      }
      sidebar={<ClientSidebar {...sidebarProps} />}
    >
      <Outlet />
    </AppShellFrame>
  );
}
