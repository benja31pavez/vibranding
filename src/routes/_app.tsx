import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Users, LogOut, Sparkles, DollarSign, UserCircle2, X,
  LayoutDashboard, CalendarDays, BarChart3, LineChart,
  Eye, Instagram, Megaphone, Target, CheckSquare, Wallet,
  Link2, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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

  const HeaderItem = ({ to, icon: Icon, label, active }: any) => (
    <Link
      to={to}
      className={`flex items-center justify-center gap-2 w-32 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
      }`}
    >
      <Icon className="w-4 h-4" /> <span className="hidden lg:inline">{label}</span>
    </Link>
  );

  const subClass = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
    }`;

  const clientBase = activeClient ? `/clients/${activeClient.id}` : "";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-sidebar/95 backdrop-blur">
        <div className="flex items-center gap-4 px-4 md:px-6 h-16">
          <a href="/" className="flex items-center gap-2 shrink-0">
            <span className="font-brand text-2xl tracking-tight text-gradient-brand bg-gradient-brand-animated">Vibranding</span>
          </a>
          <nav className="flex items-center justify-center gap-2 flex-1 min-w-0 overflow-x-auto">
            <HeaderItem to="/dashboard" icon={LayoutDashboard} label="Inicio" active={path === "/dashboard"} />
            <HeaderItem to="/clients" icon={Users} label="Clientes" active={path === "/clients"} />
            <HeaderItem to="/calendar" icon={CalendarDays} label="Calendario" active={path === "/calendar"} />
            <HeaderItem to="/reports" icon={BarChart3} label="Reportes" active={path === "/reports"} />
            <HeaderItem to="/settings/pricing" icon={DollarSign} label="Servicios" active={path.startsWith("/settings/pricing")} />
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-full px-2">
                  <UserCircle2 className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sesión iniciada</div>
                  <div className="truncate text-sm font-medium mt-1">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to="/portfolio"><Sparkles className="w-4 h-4 mr-2" /> Portafolio público</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to="/stats"><LineChart className="w-4 h-4 mr-2" /> Estadísticas del landing</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar sticky top-16 h-[calc(100vh-4rem)]">
          <nav className="px-3 py-6 space-y-6 flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3">
              <div className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cliente conectado</div>
              {activeClient ? (
                <>
                  <div
                    className={`group flex items-center gap-2 mx-1 pl-3 pr-1 py-3 rounded-lg border text-sm ${
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
                          <div className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">@{activeClient.instagram_handle}</div>
                        )}
                      </div>
                    </Link>
                    <button onClick={clearActive} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background/60 text-muted-foreground" title="Desconectar">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <Link to="/clients/$clientId/instagram" params={{ clientId: activeClient.id }} className={subClass(path === `${clientBase}/instagram`)}>
                      <Instagram className="w-4 h-4 shrink-0" /> Instagram
                    </Link>
                    <Link to="/clients/$clientId/meta-ads" params={{ clientId: activeClient.id }} className={subClass(path === `${clientBase}/meta-ads`)}>
                      <Megaphone className="w-4 h-4 shrink-0" /> Meta Ads
                    </Link>
                    <Link to="/clients/$clientId/objectives" params={{ clientId: activeClient.id }} className={subClass(path === `${clientBase}/objectives`)}>
                      <Target className="w-4 h-4 shrink-0" /> Objetivos
                    </Link>
                    <Link to="/clients/$clientId/deliverables" params={{ clientId: activeClient.id }} className={subClass(path === `${clientBase}/deliverables`)}>
                      <CheckSquare className="w-4 h-4 shrink-0" /> Etapas
                    </Link>
                    <Link to="/clients/$clientId/payments" params={{ clientId: activeClient.id }} className={subClass(path === `${clientBase}/payments`)}>
                      <Wallet className="w-4 h-4 shrink-0" /> Pagos
                    </Link>
                    <Link to="/clients/$clientId/multilink" params={{ clientId: activeClient.id }} className={subClass(path === `${clientBase}/multilink`)}>
                      <Link2 className="w-4 h-4 shrink-0" /> Multienlace
                    </Link>
                    <Link to="/clients/$clientId/landing" params={{ clientId: activeClient.id }} className={subClass(path === `${clientBase}/landing`)}>
                      <Globe className="w-4 h-4 shrink-0" /> Landing page
                    </Link>
                  </div>
                </>
              ) : (
                <div className="mx-1 px-3 py-3 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                  Selecciona un cliente para activarlo
                </div>
              )}
            </div>
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
