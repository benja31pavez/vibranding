import { AlertTriangle, CalendarClock, RotateCw, Target, Users } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Money, MoneyTotals, StatCard } from "@/components/app";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { META_MRR_CLP } from "@/lib/pricing/plans";
import { UPCOMING_DAYS, useClientIndex, useMrr, useOpenPayments, type MrrSummary } from "./queries";

/** Valor de una tarjeta cuya query falló: aviso + reintento de esa query. */
function RetryValue({ query }: { query: UseQueryResult<unknown> }) {
  return (
    <span role="alert" className="flex flex-wrap items-center gap-2 text-base text-danger-strong">
      No disponible
      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={query.isFetching} onClick={() => void query.refetch()}>
        <RotateCw aria-hidden className={cn("mr-1 h-3.5 w-3.5", query.isFetching && "animate-spin")} />
        Reintentar
      </Button>
    </span>
  );
}

const plural = (n: number) => `${n} ${n === 1 ? "cliente" : "clientes"}`;

/** Franja de KPIs: MRR vs meta, clientes activos, cobros próximos y vencidos. */
export function KpiStrip() {
  const mrr = useMrr();
  const clients = useClientIndex();
  const payments = useOpenPayments();
  const paymentsLoading = payments.isPending && !payments.isError;
  const overdueCount = payments.data?.overdue.length ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MrrCard query={mrr} />
      <StatCard
        icon={Users}
        label="Clientes activos"
        loading={clients.isPending && !clients.isError}
        value={clients.isError ? <RetryValue query={clients} /> : (clients.data?.activeCount ?? 0)}
      />
      <StatCard
        icon={CalendarClock}
        label={`Cobros próximos ${UPCOMING_DAYS} días`}
        loading={paymentsLoading}
        value={payments.isError ? <RetryValue query={payments} /> : (payments.data?.upcoming.length ?? 0)}
        hint={payments.data ? <MoneyTotals totals={payments.data.upcomingTotals} /> : undefined}
      />
      <StatCard
        icon={AlertTriangle}
        label="Pagos vencidos"
        loading={paymentsLoading}
        value={
          payments.isError ? (
            <RetryValue query={payments} />
          ) : (
            <span className={cn(overdueCount > 0 && "text-danger-strong")}>{overdueCount}</span>
          )
        }
        hint={payments.data ? <MoneyTotals totals={payments.data.overdueTotals} /> : undefined}
      />
    </div>
  );
}

function MrrCard({ query }: { query: UseQueryResult<MrrSummary> }) {
  if (query.isError) {
    return <StatCard icon={Target} label="MRR actual" value={<RetryValue query={query} />} />;
  }
  const data = query.data;
  const total = data?.total ?? 0;
  const pct = Math.round((total / META_MRR_CLP) * 100);
  const width = Math.min(100, Math.max(0, pct));
  return (
    <StatCard
      icon={Target}
      label="MRR actual"
      loading={query.isPending}
      value={<Money amount={total} />}
      hint={
        data && (
          <span className="flex w-full flex-col gap-1.5">
            <span
              role="progressbar"
              aria-label="Avance hacia la meta de MRR"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={width}
              className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
            >
              <span
                className={cn("block h-full rounded-full", pct >= 100 ? "bg-success" : "bg-primary")}
                style={{ width: `${width}%` }}
              />
            </span>
            <span>
              <span className="font-medium tabular-nums text-foreground">{pct}%</span> de la meta{" "}
              <Money amount={META_MRR_CLP} />
            </span>
            <span>
              Suscripciones <Money amount={data.fromSubscriptions} /> ({plural(data.subscriptionClients)}) ·
              Facturación manual <Money amount={data.fromBilling} /> ({plural(data.billingClients)})
            </span>
          </span>
        )
      }
    />
  );
}
