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

const DAY_MS = 86_400_000;
const LIST_LIMIT = 10;

/** Mensaje legible para errores de Supabase (PostgrestError no es `Error`) u otros. */
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") return e.message;
  return "Error desconocido";
}

const EMPTY_STATS: Stats = {
  clients: 0,
  upcomingDeliverables: [],
  pendingPayments: [],
  scheduledPosts: [],
  monthRevenue: {},
};

/** Carga los datos del inicio. Lanza el primer error real de Supabase. */
async function loadStats(): Promise<Stats> {
  const { data: clients, error: clientsError } = await supabase.from("clients").select("id,name");
  if (clientsError) throw clientsError;
  const ids = (clients ?? []).map((c) => c.id);
  if (ids.length === 0) return EMPTY_STATS;
  const nameById = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const clientName = (id: string) => nameById.get(id) ?? "—";

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * DAY_MS).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [dels, pays, posts, paid] = await Promise.all([
    supabase.from("deliverables").select("id,title,due_date,client_id").in("client_id", ids).neq("status", "done").lte("due_date", in7).order("due_date", { ascending: true }).limit(LIST_LIMIT),
    supabase.from("payments").select("id,amount,currency,description,due_date,client_id,status").in("client_id", ids).neq("status", "paid").neq("status", "cancelled").order("due_date", { ascending: true }).limit(LIST_LIMIT),
    supabase.from("instagram_posts").select("id,scheduled_at,client_id,type").in("client_id", ids).gte("scheduled_at", today).order("scheduled_at", { ascending: true }).limit(LIST_LIMIT),
    supabase.from("payments").select("amount,currency,paid_at").in("client_id", ids).eq("status", "paid").gte("paid_at", monthStart),
  ]);
  const firstError = dels.error ?? pays.error ?? posts.error ?? paid.error;
  if (firstError) throw firstError;

  return {
    clients: clients?.length ?? 0,
    upcomingDeliverables: (dels.data ?? []).map((d) => ({ ...d, client_name: clientName(d.client_id) })),
    pendingPayments: (pays.data ?? []).map((p) => ({ ...p, client_name: clientName(p.client_id) })),
    scheduledPosts: (posts.data ?? []).map((p) => ({ ...p, scheduled_at: p.scheduled_at ?? "", client_name: clientName(p.client_id) })),
    monthRevenue: (paid.data ?? []).reduce<MoneyByCurrency>(
      (acc, x) => addMoney(acc, x.currency, Number(x.amount)),
      {},
    ),
  };
}

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadStats()
      .then((next) => {
        if (cancelled) return;
        setStats(next);
        setError(null);
      })
      .catch((e: unknown) => {
        console.error("[dashboard] error al cargar", e);
        if (!cancelled) setError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setRetrying(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

  const loading = !stats && !error;
  const retry = () => {
    setRetrying(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8 md:px-10">
      <PageHeader title="Inicio" description="Resumen de tus clientes y actividad reciente." />

      {error && !stats && <ErrorState message={error} onRetry={retry} retrying={retrying} />}

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
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{new Date(p.scheduled_at).toLocaleString("es-CL")}</span>
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
              <span className="text-muted-foreground"> · {a.author_name ?? "Cliente"} · {new Date(a.created_at).toLocaleDateString("es-CL")}</span>
              {a.body && <span className="block truncate text-muted-foreground">{a.body}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
