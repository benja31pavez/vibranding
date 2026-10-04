import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart3,
  Eye,
  Heart,
  Images,
  Megaphone,
  MousePointerClick,
  Percent,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, MoneyTotals, PageContainer, PageHeader, StatCard, TableSkeleton } from "@/components/app";
import { LatestReportsTable } from "@/components/reports/LatestReportsTable";
import {
  DEFAULT_RANGE_DAYS,
  REPORT_RANGES,
  ctrPercent,
  useClientMetrics,
  type ClientMetricsRow,
  type ReportRangeDays,
} from "@/components/reports/clientMetrics";
import type { MoneyByCurrency } from "@/lib/pricing/plans";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reportes por cliente · Vibranding" },
      {
        name: "description",
        content:
          "Métricas agregadas por cliente: publicaciones, inversión publicitaria, clicks, conversaciones y cobros, siempre separados por moneda.",
      },
      { property: "og:title", content: "Reportes por cliente · Vibranding" },
      {
        property: "og:description",
        content: "Resumen de resultados por cliente con montos agrupados por su moneda real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const NUM = new Intl.NumberFormat("es-CL");
const PCT = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DAY = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "UTC" });
const fmtDay = (iso: string) => DAY.format(new Date(`${iso}T12:00:00Z`));
const fmtPct = (value: number) => `${PCT.format(value)} %`;

function MoneyCell({ money }: { money: MoneyByCurrency }) {
  const hasValue = Object.values(money).some((v) => v !== 0);
  if (!hasValue) return <span className="text-muted-foreground">—</span>;
  return <MoneyTotals totals={money} className="whitespace-nowrap" />;
}

function ReportsPage() {
  const [days, setDays] = useState<ReportRangeDays>(DEFAULT_RANGE_DAYS);
  const metrics = useClientMetrics(days);
  const data = metrics.data;
  const loading = metrics.isPending && !metrics.isError;
  const totals = data?.totals;

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Reportes"
        description="Métricas agregadas por cliente. Los montos se agrupan por moneda y nunca se suman entre monedas distintas."
      />

      <LatestReportsTable />

      <section className="space-y-4" aria-labelledby="metrics-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="metrics-title" className="text-lg font-semibold">
              Resultados por cliente
            </h2>
            <p className="text-sm text-muted-foreground">
              {data
                ? `Del ${fmtDay(data.from)} al ${fmtDay(data.to)} (hora de Chile). "Pendiente" es todo lo abierto hoy.`
                : "Publicaciones, Ads y cobros del período elegido."}
            </p>
          </div>
          <div role="group" aria-label="Rango de fechas" className="flex flex-wrap gap-2">
            {REPORT_RANGES.map((r) => (
              <Button
                key={r.days}
                size="sm"
                variant={days === r.days ? "default" : "outline"}
                aria-pressed={days === r.days}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>

        {metrics.isError ? (
          <ErrorState
            message={metrics.error instanceof Error ? metrics.error.message : undefined}
            onRetry={() => void metrics.refetch()}
            retrying={metrics.isFetching}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                icon={Images}
                label="Publicaciones"
                loading={loading}
                value={NUM.format(totals?.posts ?? 0)}
              />
              <StatCard
                icon={Heart}
                label="Likes IG"
                loading={loading}
                value={NUM.format(totals?.likes ?? 0)}
              />
              <StatCard
                icon={Megaphone}
                label="Inversión Ads"
                loading={loading}
                value={<MoneyCell money={totals?.spend ?? {}} />}
              />
              <StatCard
                icon={Percent}
                label="CTR"
                loading={loading}
                value={fmtPct(ctrPercent(totals?.clicks ?? 0, totals?.impressions ?? 0))}
              />
              <StatCard
                icon={Eye}
                label="Impresiones"
                loading={loading}
                value={NUM.format(totals?.impressions ?? 0)}
              />
              <StatCard
                icon={MousePointerClick}
                label="Clicks"
                loading={loading}
                value={NUM.format(totals?.clicks ?? 0)}
              />
              <StatCard
                icon={Wallet}
                label="Cobrado"
                loading={loading}
                value={<MoneyCell money={totals?.paid ?? {}} />}
              />
              <StatCard
                icon={Wallet}
                label="Pendiente"
                loading={loading}
                value={<MoneyCell money={totals?.pending ?? {}} />}
              />
            </div>

            {loading ? (
              <TableSkeleton rows={5} columns={10} label="Cargando métricas por cliente" />
            ) : !data || data.rows.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="Aún no hay clientes."
                description="Cuando agregues clientes verás aquí sus resultados."
              />
            ) : (
              <MetricsTable rows={data.rows} />
            )}
          </>
        )}
      </section>
    </PageContainer>
  );
}

function MetricsTable({ rows }: { rows: readonly ClientMetricsRow[] }) {
  const th = "px-3 py-2 text-right font-medium";
  return (
    <div className="overflow-x-auto rounded-app-lg border border-border-subtle bg-surface shadow-app-xs">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b border-border-subtle text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Cliente
            </th>
            <th scope="col" className={th}>
              Posts
            </th>
            <th scope="col" className={th}>
              Likes
            </th>
            <th scope="col" className={th}>
              Impresiones
            </th>
            <th scope="col" className={th}>
              Clicks
            </th>
            <th scope="col" className={th}>
              CTR
            </th>
            <th scope="col" className={th}>
              Inversión
            </th>
            <th scope="col" className={th}>
              Conversaciones
            </th>
            <th scope="col" className={th}>
              Cobrado
            </th>
            <th scope="col" className={th}>
              Pendiente
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.client_id} className="border-b border-border-subtle last:border-0">
              <th scope="row" className="px-4 py-2 text-left font-medium">
                {r.client_name}
              </th>
              <td className="px-3 py-2 text-right">{NUM.format(r.posts)}</td>
              <td className="px-3 py-2 text-right">{NUM.format(r.likes)}</td>
              <td className="px-3 py-2 text-right">{NUM.format(r.impressions)}</td>
              <td className="px-3 py-2 text-right">{NUM.format(r.clicks)}</td>
              <td className="px-3 py-2 text-right">
                {fmtPct(ctrPercent(r.clicks, r.impressions))}
              </td>
              <td className="px-3 py-2 text-right">
                <MoneyCell money={r.spend} />
              </td>
              <td className="px-3 py-2 text-right">{NUM.format(r.conversions)}</td>
              <td className="px-3 py-2 text-right">
                <MoneyCell money={r.paid} />
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                <MoneyCell money={r.pending} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
