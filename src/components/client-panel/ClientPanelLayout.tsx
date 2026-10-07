import { useEffect, useState, type ReactNode } from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Menu, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/app";
import { useAuth } from "@/hooks/use-auth";
import { forgetClientAccess, resolveClientShellAccess } from "@/lib/auth/clientPanel";
import { getPanelPreview } from "@/lib/client-panel/panel.functions";
import { ClientBrandCard, ClientPanelSidebar } from "./ClientPanelSidebar";
import { PanelModeProvider, previewSearch, usePreviewParam } from "./panelMode";
import { PreviewBanner } from "./PreviewBanner";
import { ClientSelfProvider, useClientSelf, type ClientSelf } from "./useClientSelf";

const GENERIC_ERROR = "No pudimos verificar tu acceso. Revisa tu conexión e intenta de nuevo.";

type GuardResult = "client" | "preview";

/**
 * Guard del panel del cliente (cliente verificado + panel activado, o agencia
 * en vista previa). Falla CERRADO: hasta confirmar se muestra un fondo vacío
 * y, si la verificación falla, "Reintentar"; nunca el contenido.
 */
function useClientShellGuard(userId: string | undefined, preview: string | null) {
  const navigate = useNavigate();
  const key = userId ? `${userId}:${preview ?? ""}` : null;
  const [allowed, setAllowed] = useState<{ key: string; as: GuardResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId || !key) return;
    let cancelled = false;
    setError(null);
    resolveClientShellAccess(userId, preview ?? undefined).then(
      (access) => {
        if (cancelled) return;
        if (access.kind === "redirect") navigate({ to: access.to, search: {}, replace: true });
        else setAllowed({ key, as: access.kind === "preview" ? "preview" : "client" });
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error && e.message ? e.message : GENERIC_ERROR);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId, key, preview, navigate, attempt]);

  const retry = () => {
    if (!userId) return;
    forgetClientAccess(userId);
    setAttempt((n) => n + 1);
  };
  const as = key && allowed?.key === key ? allowed.as : null;
  return { as, error, retry };
}

/**
 * Marca del cliente en vista previa: el servidor exige rol en la org dueña de
 * ese cliente (getClientOrgRole). Si no, error y nunca el contenido.
 */
function usePreviewBrand(userId: string | undefined, preview: string | null) {
  const load = useServerFn(getPanelPreview);
  return useQuery({
    queryKey: ["client-panel", userId ?? "anon", "preview", preview ?? "none"],
    enabled: Boolean(userId && preview),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<ClientSelf> => {
      if (!preview) throw new Error(GENERIC_ERROR);
      return load({ data: { preview } });
    },
  });
}

function BlankScreen() {
  return <div className="app-brand min-h-screen bg-bg" aria-busy="true" />;
}

function RetryScreen({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <div
      role="alert"
      className="app-brand flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-center"
    >
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <div className="flex gap-2">
        <Button onClick={onRetry}>Reintentar</Button>
        <Button variant="ghost" onClick={onSignOut}>
          Salir
        </Button>
      </div>
    </div>
  );
}

/** Layout de /mi: comprueba sesión y acceso, y carga la marca del cliente desde la sesión. */
export function ClientPanelLayout() {
  const { session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user?.id;
  const preview = usePreviewParam();
  const guard = useClientShellGuard(userId, preview);
  const self = useClientSelf(guard.as === "client" ? userId : undefined);
  const previewBrand = usePreviewBrand(guard.as === "preview" ? userId : undefined, preview);
  const onSignOut = () => {
    forgetClientAccess(userId);
    void signOut();
  };

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (guard.error && !guard.as) {
    return <RetryScreen message={guard.error} onRetry={guard.retry} onSignOut={onSignOut} />;
  }
  if (loading || !session || !guard.as) return <BlankScreen />;

  if (guard.as === "preview" && preview) {
    if (previewBrand.isError) {
      return (
        <RetryScreen
          message={previewBrand.error.message || GENERIC_ERROR}
          onRetry={() => void previewBrand.refetch()}
          onSignOut={onSignOut}
        />
      );
    }
    if (!previewBrand.data) return <BlankScreen />;
    return (
      <PanelModeProvider value={{ preview }}>
        <ClientSelfProvider value={previewBrand.data}>
          <ClientPanelFrame client={previewBrand.data} email={null} preview={preview}>
            <Outlet />
          </ClientPanelFrame>
        </ClientSelfProvider>
      </PanelModeProvider>
    );
  }

  if (self.isError) {
    return (
      <RetryScreen
        message={self.error.message}
        onRetry={() => void self.refetch()}
        onSignOut={onSignOut}
      />
    );
  }
  if (self.isPending) return <BlankScreen />;
  if (!self.data) {
    return (
      <div className="app-brand flex min-h-screen items-center justify-center bg-bg p-6">
        <EmptyState
          icon={UserX}
          title="Tu cuenta aún no está vinculada a una marca"
          action={
            <Button variant="outline" onClick={onSignOut}>
              Salir
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <PanelModeProvider value={{ preview: null }}>
      <ClientSelfProvider value={self.data}>
        <ClientPanelFrame client={self.data} email={user?.email ?? null} onSignOut={onSignOut}>
          <Outlet />
        </ClientPanelFrame>
      </ClientSelfProvider>
    </PanelModeProvider>
  );
}

interface ClientPanelFrameProps {
  client: ClientSelf;
  email: string | null;
  /** Sin cuenta del cliente en vista previa: no hay menú de usuario. */
  onSignOut?: () => void;
  /** Vista previa de la agencia: franja fija y enlaces que conservan `?preview=`. */
  preview?: string | null;
  children: ReactNode;
}

/**
 * Marco del panel del cliente: SOLO el panel izquierdo (sin header de agencia ni
 * buscador). Desde md ocupa la ventana sin scroll de página; en móvil, una barra
 * mínima con la marca y el menú en un Sheet.
 */
export function ClientPanelFrame({
  client,
  email,
  onSignOut,
  preview = null,
  children,
}: ClientPanelFrameProps) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [path]);
  const sidebarProps = { client, path, email, onSignOut, search: previewSearch(preview) };

  return (
    <div className="app-brand flex min-h-screen flex-col bg-background md:h-dvh md:min-h-0 md:overflow-hidden">
      {preview && <PreviewBanner />}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Saltar al contenido
        </a>

        <div className="sticky top-0 z-30 flex items-center gap-2 border-b bg-sidebar/95 px-3 py-2 backdrop-blur md:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Menú">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[280px] max-w-[85vw] flex-col p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Menú</SheetTitle>
                <SheetDescription>Secciones de tu marca</SheetDescription>
              </SheetHeader>
              <ClientPanelSidebar {...sidebarProps} inSheet />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <ClientBrandCard client={client} />
          </div>
        </div>

        <aside
          aria-label="Panel de tu marca"
          className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex"
        >
          <ClientPanelSidebar {...sidebarProps} />
        </aside>
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 focus:outline-none md:min-h-0 md:overflow-y-auto"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
