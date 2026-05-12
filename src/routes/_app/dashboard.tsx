import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Users, CheckSquare, DollarSign, CalendarClock, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

interface Stats {
  clients: number;
  upcomingDeliverables: { id: string; title: string; due_date: string | null; client_id: string; client_name: string }[];
  pendingPayments: { id: string; amount: number; currency: string; description: string | null; due_date: string | null; client_id: string; client_name: string }[];
  scheduledPosts: { id: string; scheduled_at: string; client_id: string; client_name: string; type: string }[];
  monthRevenue: number;
  currency: string;
}

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: clients } = await supabase.from("clients").select("id,name");
      const ids = (clients ?? []).map((c) => c.id);
      const nameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      const [{ data: dels }, { data: pays }, { data: posts }, { data: paid }] = await Promise.all([
        ids.length
          ? supabase.from("deliverables").select("id,title,due_date,client_id").in("client_id", ids).neq("status", "done").lte("due_date", in7).order("due_date", { ascending: true }).limit(10)
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase.from("payments").select("id,amount,currency,description,due_date,client_id,status").in("client_id", ids).neq("status", "paid").neq("status", "cancelled").order("due_date", { ascending: true }).limit(10)
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase.from("instagram_posts").select("id,scheduled_at,client_id,type").in("client_id", ids).gte("scheduled_at", today).order("scheduled_at", { ascending: true }).limit(10)
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase.from("payments").select("amount,currency,paid_at").in("client_id", ids).eq("status", "paid").gte("paid_at", monthStart)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const monthRevenue = (paid ?? []).reduce((s, x: any) => s + Number(x.amount), 0);
      const currency = (paid ?? [])[0]?.currency ?? "USD";

      setStats({
        clients: clients?.length ?? 0,
        upcomingDeliverables: (dels ?? []).map((d: any) => ({ ...d, client_name: nameById.get(d.client_id) ?? "—" })),
        pendingPayments: (pays ?? []).map((p: any) => ({ ...p, client_name: nameById.get(p.client_id) ?? "—" })),
        scheduledPosts: (posts ?? []).map((p: any) => ({ ...p, client_name: nameById.get(p.client_id) ?? "—" })),
        monthRevenue,
        currency,
      });
    })();
  }, [user]);

  const Card = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) => (
    <div className="rounded-2xl border bg-surface p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-3xl font-semibold mt-2">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Inicio</h1>
        <p className="text-muted-foreground">Resumen de tus clientes y actividad reciente.</p>
      </header>

      {!stats ? (
        <div className="text-muted-foreground text-sm">Cargando…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card icon={Users} label="Clientes" value={String(stats.clients)} />
            <Card icon={CheckSquare} label="Entregables próximos" value={String(stats.upcomingDeliverables.length)} hint="próximos 7 días" />
            <Card icon={DollarSign} label="Pagos pendientes" value={String(stats.pendingPayments.length)} />
            <Card icon={TrendingUp} label="Ingresos del mes" value={`${stats.currency} ${stats.monthRevenue.toFixed(0)}`} />
          </div>

          <section className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border bg-surface p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><CheckSquare className="w-4 h-4" /> Próximos entregables</h2>
              {stats.upcomingDeliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada pendiente esta semana.</p>
              ) : (
                <ul className="space-y-2">
                  {stats.upcomingDeliverables.map((d) => (
                    <li key={d.id} className="flex items-center justify-between text-sm">
                      <Link to="/clients/$clientId/deliverables" params={{ clientId: d.client_id }} className="hover:underline">
                        <span className="font-medium">{d.title}</span> <span className="text-muted-foreground">· {d.client_name}</span>
                      </Link>
                      <span className="text-xs text-muted-foreground">{d.due_date ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border bg-surface p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Pagos pendientes</h2>
              {stats.pendingPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin pagos pendientes.</p>
              ) : (
                <ul className="space-y-2">
                  {stats.pendingPayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <Link to="/clients/$clientId/payments" params={{ clientId: p.client_id }} className="hover:underline">
                        <span className="font-medium">{p.client_name}</span>
                        {p.description && <span className="text-muted-foreground"> · {p.description}</span>}
                      </Link>
                      <span className="text-xs">{p.currency} {Number(p.amount).toFixed(0)} <span className="text-muted-foreground">{p.due_date ?? ""}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border bg-surface p-5 lg:col-span-2">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Próximas publicaciones</h2>
              {stats.scheduledPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin publicaciones programadas.</p>
              ) : (
                <ul className="space-y-2">
                  {stats.scheduledPosts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <Link to="/clients/$clientId/instagram" params={{ clientId: p.client_id }} className="hover:underline">
                        <span className="font-medium">{p.client_name}</span> <span className="text-muted-foreground">· {p.type}</span>
                      </Link>
                      <span className="text-xs text-muted-foreground">{new Date(p.scheduled_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
