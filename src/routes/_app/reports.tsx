import { createFileRoute, Link } from "@tanstack/react-router";
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
import {
  EmptyState,
  ErrorState,
  MoneyTotals,
  PageContainer,
  PageHeader,
  StatCard,
  TableSkeleton,
} from "@/components/app";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GrowthView } from "@/components/reports/growth/GrowthView";
import { LatestReportsTable } from "@/components/reports/LatestReportsTable";
import {
  DEFAULT_RANGE_DAYS,
  REPORT_RANGES,
  ctrPercent,
  useClientMetrics,
  type ClientMetricsRow,
  type MetricsTotals,
  type ReportRangeDays,
} from "@/components/reports/clientMetrics";
import { EMPTY_CLP_TOTALS, type ClpTotals } from "@/lib/pricing/plans";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reportes por cliente · Vibranding" },
      {
        name: "description",
        content:
          "Métricas agregadas por cliente: publicaciones, inversión publicitaria, clicks, conversaciones y cobros en CLP.",
      },
      { property: "og:title", content: "Reportes por cliente · Vibranding" },
      {
        property: "og:description",
        content: "Resumen de resultados por cliente con montos en CLP.",
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

function MoneyCell({ money }: { money: ClpTotals }) {
  const hasValue = money.clp !== 0 || money.excludedCurrencies.length > 0;
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
      <PageHeader title="Reportes" />

      <Tabs defaultValue="clientes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="clientes">Por cliente</TabsTrigger>
          <TabsTrigger value="crecimiento">Crecimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="crecimiento">
          <GrowthView />
        </TabsContent>

        <TabsContent value="clientes" className="space-y-8">
          <LatestReportsTable />

          <section className="space-y-4" aria-labelledby="metrics-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="metrics-title" className="text-lg font-semibold">
                  Resultados por cliente
                </h2>
                <p className="text-sm text-muted-foreground">
                  {data ? `Del ${fmtDay(data.from)} al ${fmtDay(data.to)}` : "\u00a0"}
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
                    value={<MoneyCell money={totals?.spend ?? EMPTY_CLP_TOTALS} />}
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
                    value={<MoneyCell money={totals?.paid ?? EMPTY_CLP_TOTALS} />}
                  />
                  <StatCard
                    icon={Wallet}
                    label="Pendiente"
                    hint="Todo lo abierto hoy"
                    loading={loading}
                    value={<MoneyCell money={totals?.pending ?? EMPTY_CLP_TOTALS} />}
                  />
                </div>

                {loading ? (
                  <TableSkeleton rows={5} columns={10} label="Cargando métricas por cliente" />
                ) : !data || data.rows.length === 0 ? (
                  <EmptyState icon={BarChart3} title="Aún no hay clientes." />
                ) : (
                  <MetricsTable rows={data.rows} totals={data.totals} />
                )}
              </>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

/** Cifra o "—" atenuado cuando es 0 (menos ruido en la tabla). */
function Count({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground">—</span>;
  return <>{NUM.format(value)}</>;
}

function CtrCell({ clicks, impressions }: { clicks: number; impressions: number }) {
  if (impressions === 0) return <span className="text-muted-foreground">—</span>;
  return <>{fmtPct(ctrPercent(clicks, impressions))}</>;
}

function MetricCells({ m }: { m: MetricsTotals }) {
  const td = "px-3 py-2 text-right";
  return (
    <>
      <td className={td}>
        <Count value={m.posts} />
      </td>
      <td className={td}>
        <Count value={m.likes} />
      </td>
      <td className={td}>
        <Count value={m.impressions} />
      </td>
      <td className={td}>
        <Count value={m.clicks} />
      </td>
      <td className={td}>
        <CtrCell clicks={m.clicks} impressions={m.impressions} />
      </td>
      <td className={td}>
        <MoneyCell money={m.spend} />
      </td>
      <td className={td}>
        <Count value={m.conversions} />
      </td>
      <td className={td}>
        <MoneyCell money={m.paid} />
      </td>
      <td className={`${td} text-muted-foreground`}>
        <MoneyCell money={m.pending} />
      </td>
    </>
  );
}

function MetricsTable({
  rows,
  totals,
}: {
  rows: readonly ClientMetricsRow[];
  totals: MetricsTotals;
}) {
  const th = "px-3 py-2 text-right font-medium";
  return (
    <div className="overflow-x-auto rounded-app-lg border border-border-subtle bg-surface shadow-app-xs">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b border-border-subtle bg-surface-2 text-left text-xs text-muted-foreground">
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
            <tr
              key={r.client_id}
              className="border-b border-border-subtle transition-colors last:border-0 hover:bg-surface-2/60"
            >
              <th scope="row" className="max-w-[240px] px-4 py-2 text-left font-medium">
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: r.client_id }}
                  className="block truncate rounded-app-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={r.client_name}
                >
                  {r.client_name}
                </Link>
              </th>
              <MetricCells m={r} />
            </tr>
          ))}
        </tbody>
        {rows.length > 1 && (
          <tfoot className="border-t border-border-subtle bg-surface-2 font-semibold tabular-nums">
            <tr>
              <th scope="row" className="px-4 py-2 text-left">
                Total
              </th>
              <MetricCells m={totals} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
