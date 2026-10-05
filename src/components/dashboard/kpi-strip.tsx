import { useEffect, useState } from "react";
import { RotateCw, Target, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { UseQueryResult } from "@tanstack/react-query";
import { CompactStats, Money, Panel } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { META_MRR_CLP } from "@/lib/pricing/plans";
import { useClientsHealth } from "@/components/clients/health";
import { countByLevel } from "@/lib/health";
import { useClientIndex, useMrr, type MrrSummary } from "./queries";
import { PipelineFunnel } from "./pipeline-funnel";

/** Valor de un indicador cuya query falló: aviso + reintento de esa query. */
function RetryValue({ query }: { query: UseQueryResult<unknown> }) {
  return (
    <span role="alert" className="flex flex-wrap items-center gap-2 text-sm text-danger-strong">
      No disponible
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
      >
        <RotateCw
          aria-hidden
          className={cn("mr-1 h-3.5 w-3.5", query.isFetching && "animate-spin")}
        />
        Reintentar
      </Button>
    </span>
  );
}

const plural = (n: number) => `${n} ${n === 1 ? "cliente" : "clientes"}`;

/**
 * Columna "Indicadores" de Inicio: avance del MRR hacia la meta, clientes
 * activos / en riesgo / en atención y el embudo de prospectos, en formato compacto
 * (entre md y lg es una franja horizontal sin el embudo, que se abre en Prospectos).
 * Los cobros próximos y vencidos están en la pestaña "Cobros" para no repetirlos.
 */
export function KpiStrip() {
  return (
    <Panel
      fill
      icon={TrendingUp}
      title="Indicadores"
      bodyClassName="flex flex-col gap-4 md:max-lg:grid md:max-lg:grid-cols-2 md:max-lg:items-start"
    >
      <MrrBlock query={useMrr()} />
      <ClientStats />
      {/* md–lg: Indicadores es una franja; el embudo completo queda en Prospectos. */}
      <div className="md:max-lg:hidden">
        <PipelineFunnel />
      </div>
    </Panel>
  );
}

function MrrBlock({ query }: { query: UseQueryResult<MrrSummary> }) {
  const label = (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Target aria-hidden className="h-3.5 w-3.5" /> MRR neto · meta <Money amount={META_MRR_CLP} />
    </span>
  );
  if (query.isError) {
    return (
      <div className="space-y-1">
        {label}
        <RetryValue query={query} />
      </div>
    );
  }
  const data = query.data;
  if (!data) {
    return (
      <div className="space-y-2" role="status" aria-label="Cargando MRR">
        {label}
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-1.5 w-full" />
      </div>
    );
  }
  const pct = Math.round((data.total / META_MRR_CLP) * 100);
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div className="space-y-1.5">
      {label}
      <p className="flex items-baseline justify-between gap-2">
        <Money amount={data.total} className="text-2xl font-semibold tabular-nums" />
        <span className="text-sm font-medium tabular-nums">{pct}%</span>
      </p>
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
      <p className="text-xs text-muted-foreground md:max-lg:hidden">
        Suscripciones <Money amount={data.fromSubscriptions} /> ({plural(data.subscriptionClients)})
        · Manual <Money amount={data.fromBilling} /> ({plural(data.billingClients)})
      </p>
    </div>
  );
}

/**
 * Activos + "Salud del cliente" (src/lib/health). Los pausados nunca llegan a
 * "En riesgo". La salud se habilita tras el primer pintado para no competir con el resto.
 */
function ClientStats() {
  const clients = useClientIndex();
  const [painted, setPainted] = useState(false);
  useEffect(() => setPainted(true), []);
  const health = useClientsHealth({ enabled: painted });
  const counts = health.data ? countByLevel(health.data.values()) : null;
  const atRisk = counts?.en_riesgo ?? 0;
  const healthLoading = !painted || (health.isPending && !health.isError);
  const failed = clients.isError ? clients : health.isError ? health : null;

  return (
    <div className="space-y-1.5">
      <CompactStats
        label="Clientes"
        items={[
          {
            key: "activos",
            label: "Activos",
            loading: clients.isPending && !clients.isError,
            value: clients.isError ? "—" : (clients.data?.activeCount ?? 0),
          },
          {
            key: "riesgo",
            label: "En riesgo",
            loading: healthLoading,
            tone: atRisk > 0 ? "danger" : "default",
            value: health.isError ? "—" : atRisk,
          },
          {
            key: "atencion",
            label: "Atención",
            loading: healthLoading,
            value: health.isError ? "—" : (counts?.atencion ?? 0),
          },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {failed ? <RetryValue query={failed} /> : <span />}
        <Link to="/clients" className="font-medium text-primary underline-offset-2 hover:underline">
          Ver clientes
        </Link>
      </div>
    </div>
  );
}
