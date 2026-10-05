import { Filter, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Panel, StatCard, TableSkeleton } from "@/components/app";
import type { FunnelStage, SourceRow } from "@/lib/growth/funnel";
import { FUNNEL_RANGES, useFunnel, type FunnelRangeDays } from "./growthQueries";

const NUM = new Intl.NumberFormat("es-CL");
const PCT = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });
const fmtPct = (v: number | null) => (v === null ? "—" : `${PCT.format(v)} %`);

interface FunnelPanelProps {
  days: FunnelRangeDays;
  onDaysChange: (days: FunnelRangeDays) => void;
}

export function FunnelPanel({ days, onDaysChange }: FunnelPanelProps) {
  const query = useFunnel(days);
  const loading = query.isPending && !query.isError;
  const data = query.data;

  const rangeSelector = (
    <div role="group" aria-label="Rango del embudo" className="flex flex-wrap gap-2">
      {FUNNEL_RANGES.map((r) => (
        <Button
          key={r.days}
          size="sm"
          variant={days === r.days ? "default" : "outline"}
          aria-pressed={days === r.days}
          onClick={() => onDaysChange(r.days)}
        >
          {r.label}
        </Button>
      ))}
    </div>
  );

  return (
    <>
      <Panel
        icon={Filter}
        title="Embudo comercial"
        description="Prospectos creados en el período (sin bajas; los fríos sí cuentan) y hasta dónde llegaron."
        actions={rangeSelector}
      >
        {query.isError ? (
          <ErrorState
            message={query.error instanceof Error ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : loading || !data ? (
          <TableSkeleton rows={4} columns={3} label="Cargando embudo" />
        ) : data.funnel.stages[0].count === 0 ? (
          <EmptyState
            icon={Filter}
            size="compact"
            title="Sin prospectos nuevos en este período."
            description="Cuando entren prospectos (diagnóstico web, oficina de agentes, referidos…) verás aquí el embudo."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <FunnelBars stages={data.funnel.stages} />
            <div className="grid content-start gap-3">
              <StatCard
                label="Conversión total"
                value={fmtPct(data.funnel.overallConversion)}
                hint="Ganados / nuevos"
              />
              <StatCard
                icon={Timer}
                label="Mediana días a cierre"
                value={
                  data.funnel.medianDaysToClose === null
                    ? "—"
                    : NUM.format(data.funnel.medianDaysToClose)
                }
                hint={`Base: ${NUM.format(data.funnel.closedWithDate)} propuesta(s) aceptada(s)`}
              />
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="Fuentes que más convierten"
        description="Mismo período del embudo, agrupado por origen del prospecto."
      >
        {query.isError ? null : loading || !data ? (
          <TableSkeleton rows={3} columns={5} label="Cargando fuentes" />
        ) : data.sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos en este período.</p>
        ) : (
          <SourcesTable rows={data.sources} />
        )}
      </Panel>
    </>
  );
}

function FunnelBars({ stages }: { stages: readonly FunnelStage[] }) {
  const top = Math.max(1, stages[0]?.count ?? 0);
  return (
    <ol className="space-y-3">
      {stages.map((s) => (
        <li key={s.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{s.label}</span>
            <span className="tabular-nums">
              {NUM.format(s.count)}
              {s.conversionFromPrev !== null && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {fmtPct(s.conversionFromPrev)} de la etapa anterior
                </span>
              )}
            </span>
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(s.count / top) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function SourcesTable({ rows }: { rows: readonly SourceRow[] }) {
  const th = "px-3 py-2 text-right font-medium";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead className="border-b border-border-subtle text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Origen
            </th>
            <th scope="col" className={th}>
              Nuevos
            </th>
            <th scope="col" className={th}>
              Con propuesta
            </th>
            <th scope="col" className={th}>
              Ganados
            </th>
            <th scope="col" className={th}>
              Tasa de cierre
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.source} className="border-b border-border-subtle last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {r.source}
              </th>
              <td className="px-3 py-2 text-right">{NUM.format(r.nuevos)}</td>
              <td className="px-3 py-2 text-right">{NUM.format(r.propuestas)}</td>
              <td className="px-3 py-2 text-right">{NUM.format(r.ganados)}</td>
              <td className="px-3 py-2 text-right">{fmtPct(r.winRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
