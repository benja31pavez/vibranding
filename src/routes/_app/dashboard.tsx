import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Users, CheckSquare, DollarSign, CalendarClock, TrendingUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReviewAlerts } from "@/hooks/use-review-alerts";
import { addMoney, type MoneyByCurrency } from "@/lib/pricing/plans";
import {
  EmptyState, ErrorState, ListSkeleton, Money, MoneyTotals, PageHeader, Panel, StatCard, StatusBadge,
} from "@/components/app";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

interface Stats {
  clients: number;
  upcomingDeliverables: { id: string; title: string; due_date: string | null; client_id: string; client_name: string }[];
  pendingPayments: { id: string; amount: number; currency: string; description: string | null; due_date: string | null; client_id: string; client_name: string }[];
  scheduledPosts: { id: string; scheduled_at: string; client_id: string; client_name: string; type: string }[];
  /** Ingresos del mes agrupados por moneda. */
  monthRevenue: MoneyByCurrency;
}

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setError(null);
    (async () => {
      const { data: clients, error: clientsError } = await supabase.from("clients").select("id,name");
      if (clientsError) throw clientsError;
      const ids = (clients ?? []).map((c) => c.id);
      const nameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      const results = await Promise.all([
        ids.length
          ? supabase.from("deliverables").select("id,title,due_date,client_id").in("client_id", ids).neq("status", "done").lte("due_date", in7).order("due_date", { ascending: true }).limit(10)
          : Promise.resolve({ data: [] as any[], error: null }),
        ids.length
          ? supabase.from("payments").select("id,amount,currency,description,due_date,client_id,status").in("client_id", ids).neq("status", "paid").neq("status", "cancelled").order("due_date", { ascending: true }).limit(10)
          : Promise.resolve({ data: [] as any[], error: null }),
        ids.length
          ? supabase.from("instagram_posts").select("id,scheduled_at,client_id,type").in("client_id", ids).gte("scheduled_at", today).order("scheduled_at", { ascending: true }).limit(10)
          : Promise.resolve({ data: [] as any[], error: null }),
        ids.length
          ? supabase.from("payments").select("amount,currency,paid_at").in("client_id", ids).eq("status", "paid").gte("paid_at", monthStart)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
      const [{ data: dels }, { data: pays }, { data: posts }, { data: paid }] = results;

      const monthRevenue = (paid ?? []).reduce<MoneyByCurrency>(
        (acc, x: any) => addMoney(acc, x.currency, Number(x.amount)),
        {},
      );

      if (cancelled) return;
      setStats({
        clients: clients?.length ?? 0,
        upcomingDeliverables: (dels ?? []).map((d: any) => ({ ...d, client_name: nameById.get(d.client_id) ?? "—" })),
        pendingPayments: (pays ?? []).map((p: any) => ({ ...p, client_name: nameById.get(p.client_id) ?? "—" })),
        scheduledPosts: (posts ?? []).map((p: any) => ({ ...p, client_name: nameById.get(p.client_id) ?? "—" })),
        monthRevenue,
      });
    })().catch((e: unknown) => {
      console.error("[dashboard] error al cargar", e);
      if (!cancelled) setError(e instanceof Error ? e.message : "Error desconocido");
    });
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

  const loading = !stats && !error;
  const retry = () => setReloadKey((k) => k + 1);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8 md:px-10">
      <PageHeader title="Inicio" description="Resumen de tus clientes y actividad reciente." />

      {error && !stats && <ErrorState message={error} onRetry={retry} />}

      {!error || stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={Users} label="Clientes" loading={loading} value={stats?.clients ?? 0} />
            <StatCard icon={CheckSquare} label="Etapas próximas" loading={loading} value={stats?.upcomingDeliverables.length ?? 0} hint="próximos 7 días" />
            <StatCard icon={DollarSign} label="Pagos pendientes" loading={loading} value={stats?.pendingPayments.length ?? 0} />
            <StatCard icon={TrendingUp} label="Ingresos del mes" loading={loading} value={stats ? <MoneyTotals totals={stats.monthRevenue} /> : null} />
          </div>

          <ReviewActivity />

          <section className="grid gap-4 lg:grid-cols-2">
            <Panel icon={CheckSquare} title="Próximas etapas">
              {!stats ? (
                <ListSkeleton rows={3} label="Cargando etapas" />
              ) : stats.upcomingDeliverables.length === 0 ? (
                <EmptyState size="compact" title="Nada pendiente esta semana." />
              ) : (
                <ul className="space-y-2">
                  {stats.upcomingDeliverables.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                      <Link to="/clients/$clientId/deliverables" params={{ clientId: d.client_id }} className="min-w-0 truncate hover:underline">
                        <span className="font-medium">{d.title}</span> <span className="text-muted-foreground">· {d.client_name}</span>
                      </Link>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{d.due_date ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel icon={DollarSign} title="Pagos pendientes">
              {!stats ? (
                <ListSkeleton rows={3} label="Cargando pagos" />
              ) : stats.pendingPayments.length === 0 ? (
                <EmptyState size="compact" title="Sin pagos pendientes." />
              ) : (
                <ul className="space-y-2">
                  {stats.pendingPayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                      <Link to="/clients/$clientId/payments" params={{ clientId: p.client_id }} className="min-w-0 truncate hover:underline">
                        <span className="font-medium">{p.client_name}</span>
                        {p.description && <span className="text-muted-foreground"> · {p.description}</span>}
                      </Link>
                      <span className="shrink-0 text-xs">
                        <Money amount={Number(p.amount)} currency={p.currency} />{" "}
                        <span className="tabular-nums text-muted-foreground">{p.due_date ?? ""}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel icon={CalendarClock} title="Próximas publicaciones" className="lg:col-span-2">
              {!stats ? (
                <ListSkeleton rows={3} label="Cargando publicaciones" />
              ) : stats.scheduledPosts.length === 0 ? (
                <EmptyState size="compact" title="Sin publicaciones programadas." />
              ) : (
                <ul className="space-y-2">
                  {stats.scheduledPosts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                      <Link to="/clients/$clientId/instagram" params={{ clientId: p.client_id }} className="min-w-0 truncate hover:underline">
                        <span className="font-medium">{p.client_name}</span> <span className="text-muted-foreground">· {p.type}</span>
                      </Link>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{new Date(p.scheduled_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>
        </>
      ) : null}
    </div>
  );
}

/** Unread client approvals / change requests across all clients. */
function ReviewActivity() {
  const { alerts, loading, reload } = useReviewAlerts();
  if (loading || alerts.length === 0) return null;
  const markRead = async () => {
    await supabase
      .from("deliverable_comments")
      .update({ read_by_agency: true })
      .in("id", alerts.map((a) => a.id));
    reload();
  };
  return (
    <Panel
      tone="warning"
      icon={MessageSquare}
      title={`Revisiones de clientes (${alerts.length})`}
      actions={
        <Button size="sm" variant="ghost" className="text-xs" onClick={markRead}>
          Marcar como leído
        </Button>
      }
    >
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-sm">
            <StatusBadge status={a.kind} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              <Link to="/clients/$clientId/plan" params={{ clientId: a.client_id }} className="font-medium hover:underline">
                {a.deliverable_title}
              </Link>
              <span className="text-muted-foreground"> · {a.author_name ?? "Cliente"} · {new Date(a.created_at).toLocaleDateString()}</span>
              {a.body && <span className="block truncate text-muted-foreground">{a.body}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
