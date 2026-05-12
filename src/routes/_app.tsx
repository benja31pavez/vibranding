import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Users, LogOut, Sparkles, DollarSign, UserCircle2, X,
  LayoutDashboard, CalendarDays, BarChart3,
  Eye, Instagram, Megaphone, Target, CheckSquare, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

interface ActiveC { id: string; name: string; instagram_handle: string | null }

function AppLayout() {
  const { session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [activeClient, setActiveClient] = useState<ActiveC | null>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

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
    supabase.from("clients").select("id,name,instagram_handle").eq("id", targetId).maybeSingle()
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

  const NavItem = ({ to, params, icon: Icon, label, active }: any) => (
    <Link
      to={to}
      params={params}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </Link>
  );

  const SubNavItem = ({ to, icon: Icon, label, active }: { to: string; icon: any; label: string; active: boolean }) => (
    <Link
      to="/clients/$clientId/$"
      params={{ clientId: activeClient!.id, _splat: to }}
      className={`flex items-center gap-2.5 pl-3 pr-3 py-1.5 rounded-md text-[13px] transition-colors ${
        active ? "bg-sidebar-accent/80 text-sidebar-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40"
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" /> {label}
    </Link>
  );

  const clientBase = activeClient ? `/clients/${activeClient.id}` : "";

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar">
        <div className="px-6 py-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-semibold tracking-tight">Viralitycs</span>
          </Link>
        </div>

        <nav className="px-3 space-y-4 overflow-y-auto pb-4">
          {/* Global */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">General</div>
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Inicio" active={path === "/dashboard"} />
            <NavItem to="/clients" icon={Users} label="Clientes" active={path === "/clients"} />
            <NavItem to="/calendar" icon={CalendarDays} label="Calendario" active={path === "/calendar"} />
            <NavItem to="/reports" icon={BarChart3} label="Reportes" active={path === "/reports"} />
            <NavItem to="/settings/pricing" icon={DollarSign} label="Tarifas" active={path.startsWith("/settings/pricing")} />
          </div>

          {/* Cliente conectado */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Cliente conectado</div>
            {activeClient ? (
              <>
                <div
                  className={`group flex items-center gap-2 mx-1 pl-2 pr-1 py-2 rounded-lg border text-sm ${
                    path.startsWith(clientBase)
                      ? "border-primary/40 bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <Link to="/clients/$clientId" params={{ clientId: activeClient.id }} className="flex items-center gap-2 min-w-0 flex-1">
                    <UserCircle2 className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate font-medium leading-tight">{activeClient.name}</div>
                      {activeClient.instagram_handle && (
                        <div className="truncate text-[11px] text-muted-foreground leading-tight">@{activeClient.instagram_handle}</div>
                      )}
                    </div>
                  </Link>
                  <button onClick={clearActive} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background/60 text-muted-foreground" title="Desconectar">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-0.5 ml-2 pl-2 border-l border-border">
                  <SubNavItem to="/clients/$clientId" icon={Eye} label="Resumen" active={path === clientBase} />
                  <SubNavItem to="/clients/$clientId/instagram" icon={Instagram} label="Instagram" active={path === `${clientBase}/instagram`} />
                  <SubNavItem to="/clients/$clientId/meta-ads" icon={Megaphone} label="Meta Ads" active={path === `${clientBase}/meta-ads`} />
                  <SubNavItem to="/clients/$clientId/objectives" icon={Target} label="Objetivos" active={path === `${clientBase}/objectives`} />
                  <SubNavItem to="/clients/$clientId/deliverables" icon={CheckSquare} label="Entregables" active={path === `${clientBase}/deliverables`} />
                  <SubNavItem to="/clients/$clientId/payments" icon={Wallet} label="Pagos" active={path === `${clientBase}/payments`} />
                </div>
              </>
            ) : (
              <div className="mx-1 px-3 py-3 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                Selecciona un cliente para activarlo
              </div>
            )}
          </div>
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
