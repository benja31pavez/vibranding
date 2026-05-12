import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Users, LogOut, Sparkles, DollarSign, UserCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [activeClient, setActiveClient] = useState<{ id: string; name: string; instagram_handle: string | null } | null>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  // Detect active client from URL or load from localStorage
  useEffect(() => {
    if (!session) return;
    const match = path.match(/^\/clients\/([0-9a-f-]{36})/i);
    const idFromUrl = match?.[1];
    const stored = typeof window !== "undefined" ? localStorage.getItem("activeClientId") : null;
    const targetId = idFromUrl || stored;
    if (!targetId) {
      setActiveClient(null);
      return;
    }
    if (activeClient?.id === targetId) return;
    supabase
      .from("clients")
      .select("id,name,instagram_handle")
      .eq("id", targetId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setActiveClient(data);
          if (idFromUrl) localStorage.setItem("activeClientId", data.id);
        } else {
          setActiveClient(null);
          localStorage.removeItem("activeClientId");
        }
      });
  }, [path, session]);

  const clearActive = () => {
    setActiveClient(null);
    localStorage.removeItem("activeClientId");
    if (path.startsWith("/clients/")) navigate({ to: "/clients" });
  };

  if (loading || !session) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar">
        <div className="px-6 py-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-semibold tracking-tight">Viralitycs</span>
          </div>
        </div>
        <nav className="px-3 space-y-1">
          <Link
            to="/clients"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              path === "/clients" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            }`}
          >
            <Users className="w-4 h-4" /> Clientes
          </Link>
          {activeClient ? (
            <div
              className={`group flex items-center gap-2 ml-3 pl-3 pr-2 py-2 rounded-lg border-l-2 text-sm transition-colors ${
                path.startsWith(`/clients/${activeClient.id}`)
                  ? "border-primary bg-sidebar-accent/70 text-sidebar-accent-foreground"
                  : "border-border text-sidebar-foreground hover:bg-sidebar-accent/40"
              }`}
            >
              <Link
                to="/clients/$clientId"
                params={{ clientId: activeClient.id }}
                className="flex items-center gap-2 min-w-0 flex-1"
              >
                <UserCircle2 className="w-4 h-4 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate font-medium leading-tight">{activeClient.name}</div>
                  {activeClient.instagram_handle && (
                    <div className="truncate text-[11px] text-muted-foreground leading-tight">
                      @{activeClient.instagram_handle}
                    </div>
                  )}
                </div>
              </Link>
              <button
                onClick={clearActive}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background/60 text-muted-foreground"
                title="Desconectar cliente"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="ml-3 pl-3 py-1.5 border-l-2 border-dashed border-border text-xs text-muted-foreground italic">
              Sin cliente conectado
            </div>
          )}
          <Link
            to="/settings/pricing"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              path.startsWith("/settings/pricing") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            }`}
          >
            <DollarSign className="w-4 h-4" /> Tarifas
          </Link>
        </nav>
        <div className="mt-auto p-3 border-t">
          <div className="px-2 py-2 text-xs text-muted-foreground truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut()}>
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
