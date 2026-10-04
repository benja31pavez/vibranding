import { AlertTriangle, CalendarClock, Target, Users } from "lucide-react";
import { Money, MoneyTotals, StatCard } from "@/components/app";
import { cn } from "@/lib/utils";
import {
  MRR_GOAL_CLP,
  UPCOMING_DAYS,
  useClientIndex,
  useMrr,
  useOpenPayments,
  type MrrSummary,
} from "./queries";

const SOURCE_LABEL: Record<MrrSummary["source"], string> = {
  subscriptions: "suscripciones activas",
  client_billing: "facturación de clientes activos",
};

const ERROR_VALUE = <span className="text-base text-danger-strong">No disponible</span>;

/** Franja de KPIs: MRR vs meta, clientes activos, cobros próximos y vencidos. */
export function KpiStrip() {
  const mrr = useMrr();
  const clients = useClientIndex();
  const payments = useOpenPayments();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MrrCard query={mrr} />
      <StatCard
        icon={Users}
        label="Clientes activos"
        loading={clients.isPending && !clients.isError}
        value={clients.isError ? ERROR_VALUE : (clients.data?.activeCount ?? 0)}
      />
      <StatCard
        icon={CalendarClock}
        label={`Cobros próximos ${UPCOMING_DAYS} días`}
        loading={payments.isPending && !payments.isError}
        value={payments.isError ? ERROR_VALUE : (payments.data?.upcoming.length ?? 0)}
        hint={payments.data ? <MoneyTotals totals={payments.data.upcomingTotals} /> : undefined}
      />
      <StatCard
        icon={AlertTriangle}
        label="Pagos vencidos"
        loading={payments.isPending && !payments.isError}
        value={
          payments.isError ? (
            ERROR_VALUE
          ) : (
            <span className={cn(payments.data?.overdue.length ? "text-danger-strong" : undefined)}>
              {payments.data?.overdue.length ?? 0}
            </span>
          )
        }
        hint={payments.data ? <MoneyTotals totals={payments.data.overdueTotals} /> : undefined}
      />
    </div>
  );
}

function MrrCard({ query }: { query: ReturnType<typeof useMrr> }) {
  if (query.isError) {
    return <StatCard icon={Target} label="MRR actual" value={ERROR_VALUE} hint="Reintenta recargando la página" />;
  }
  const total = query.data?.total ?? 0;
  const pct = Math.round((total / MRR_GOAL_CLP) * 100);
  const width = Math.min(100, Math.max(0, pct));
  return (
    <StatCard
      icon={Target}
      label="MRR actual"
      loading={query.isPending}
      value={<Money amount={total} />}
      hint={
        query.data && (
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
              <Money amount={MRR_GOAL_CLP} /> · según {SOURCE_LABEL[query.data.source]}
            </span>
          </span>
        )
      }
    />
  );
}
