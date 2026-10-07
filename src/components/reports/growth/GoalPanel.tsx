import { CalendarClock, Target, TrendingUp, Users } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, ErrorState, Panel, StatCard } from "@/components/app";
import { useMrr } from "@/lib/billing/mrr";
import { chileToday } from "@/lib/dates/chile";
import { computeGoal, META_DEADLINE_MONTH, type TrendPoint } from "@/lib/growth/goal";
import { formatMoney, META_MRR_CLP, PLANS } from "@/lib/pricing/plans";
import { useRecurringTrend } from "./growthQueries";

const AXIS_FONT = 11;
const NUM = new Intl.NumberFormat("es-CL");
const COMPACT = new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 });
const MONTH_SHORT = new Intl.DateTimeFormat("es-CL", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});
const MONTH_LONG = new Intl.DateTimeFormat("es-CL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const fmtMonth = (ym: string, f: Intl.DateTimeFormat = MONTH_SHORT) =>
  f.format(new Date(`${ym}-15T12:00:00Z`));

/**
 * Ticket de respaldo cuando aún no hay clientes recurrentes: el plan mensual más
 * barato que se ofrece a clientes nuevos, en NETO (el MRR se informa neto).
 */
const MONTHLY_PRICES = PLANS.filter((p) => p.billing === "monthly" && !p.returningClientsOnly).map(
  (p) => p.netPrice,
);
const FALLBACK_TICKET = MONTHLY_PRICES.length > 0 ? Math.min(...MONTHLY_PRICES) : 0;

export function GoalPanel() {
  const mrr = useMrr();
  const trend = useRecurringTrend();
  const loading = mrr.isPending && !mrr.isError;
  const summary = mrr.data
    ? computeGoal({
        mrr: mrr.data.total,
        goal: META_MRR_CLP,
        recurringClients: mrr.data.subscriptionClients + mrr.data.billingClients,
        fallbackTicket: FALLBACK_TICKET,
        currentMonth: chileToday().slice(0, 7),
      })
    : null;

  return (
    <Panel
      icon={TrendingUp}
      title="MRR vs meta"
      description={`Meta: ${formatMoney(META_MRR_CLP)} netos (sin IVA) al mes antes de fin de ${fmtMonth(META_DEADLINE_MONTH, MONTH_LONG)}.`}
    >
      {mrr.isError ? (
        <ErrorState
          message={mrr.error instanceof Error ? mrr.error.message : undefined}
          onRetry={() => void mrr.refetch()}
          retrying={mrr.isFetching}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              icon={TrendingUp}
              label="MRR actual (neto)"
              loading={loading}
              value={formatMoney(summary?.mrr ?? 0)}
              hint={
                summary ? `${summary.progressPct.toLocaleString("es-CL")} % de la meta` : undefined
              }
            />
            <StatCard
              icon={Target}
              label="Falta para la meta"
              loading={loading}
              value={formatMoney(summary?.gap ?? 0)}
            />
            <StatCard
              icon={Users}
              label="Clientes que faltan"
              loading={loading}
              value={NUM.format(summary?.clientsNeeded ?? 0)}
              hint={
                summary
                  ? `A ${formatMoney(summary.avgTicket)} ${summary.ticketIsFallback ? "(plan mensual base)" : "de ticket promedio"}`
                  : undefined
              }
            />
            <StatCard
              icon={CalendarClock}
              label="Meses restantes"
              loading={loading}
              value={NUM.format(summary?.monthsRemaining ?? 0)}
              hint={
                summary && summary.clientsNeeded > 0
                  ? `≈ ${NUM.format(summary.clientsPerMonth)} cliente(s) nuevo(s) por mes`
                  : undefined
              }
            />
          </div>
          {summary && <ProgressBar pct={summary.progressPct} />}
          {summary?.pastDeadline && (
            <p className="text-sm text-warning-strong">
              Ya pasó {fmtMonth(META_DEADLINE_MONTH, MONTH_LONG)} y la meta no se cumplió. Actualiza
              META_DEADLINE_MONTH si se redefine el plazo.
            </p>
          )}
          <TrendBlock
            points={trend.data}
            loading={trend.isPending && !trend.isError}
            error={trend.isError ? trend.error : null}
            onRetry={() => void trend.refetch()}
          />
        </div>
      )}
    </Panel>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Avance hacia la meta de MRR"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full rounded-full bg-primary bg-gradient-brand"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface TrendBlockProps {
  points: TrendPoint[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

function TrendBlock({ points, loading, error, onRetry }: TrendBlockProps) {
  if (error) {
    return (
      <ErrorState message={error instanceof Error ? error.message : undefined} onRetry={onRetry} />
    );
  }
  const hasData = Boolean(points?.some((p) => p.collected > 0));
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground">
        Cobrado mensual (no es MRR): pagos recurrentes pagados, últimos 12 meses
      </h3>
      {loading || !points ? (
        <div className="mt-2 h-56 w-full animate-pulse rounded-app-lg bg-muted" aria-hidden />
      ) : !hasData ? (
        <EmptyState
          size="compact"
          className="mt-2"
          title="Aún no hay cobros recurrentes pagados."
          description="Cuando se paguen cobros mensuales verás aquí su evolución frente a la meta."
        />
      ) : (
        <>
          <div className="mt-2 h-56 w-full" aria-hidden>
            <TrendChart points={points} />
          </div>
          <TrendTable points={points} />
        </>
      )}
    </div>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(v: string) => fmtMonth(v)}
          fontSize={AXIS_FONT}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `$${COMPACT.format(v)}`}
          fontSize={AXIS_FONT}
          tickLine={false}
          axisLine={false}
          width={56}
          domain={[0, (max: number) => Math.max(max, META_MRR_CLP)]}
        />
        <Tooltip
          formatter={(v: number) => [formatMoney(v), "Cobrado"]}
          labelFormatter={(v: string) => fmtMonth(v, MONTH_LONG)}
        />
        <ReferenceLine
          y={META_MRR_CLP}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          label={{ value: "Meta", position: "insideTopLeft", fontSize: AXIS_FONT }}
        />
        <Line
          type="monotone"
          dataKey="collected"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={{ r: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Alternativa textual del gráfico para lectores de pantalla. */
function TrendTable({ points }: { points: TrendPoint[] }) {
  return (
    <table className="sr-only">
      <caption>Cobrado mensual frente a la meta de MRR</caption>
      <thead>
        <tr>
          <th scope="col">Mes</th>
          <th scope="col">Cobrado</th>
          <th scope="col">Meta</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.month}>
            <th scope="row">{fmtMonth(p.month, MONTH_LONG)}</th>
            <td>{formatMoney(p.collected)}</td>
            <td>{formatMoney(META_MRR_CLP)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
