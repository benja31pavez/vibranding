import { useEffect, useState } from "react";
import { HeartPulse, RotateCw, Target, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { UseQueryResult } from "@tanstack/react-query";
import { Money, StatCard } from "@/components/app";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { META_MRR_CLP } from "@/lib/pricing/plans";
import { useClientsHealth } from "@/components/clients/health";
import { countByLevel } from "@/lib/health";
import { useClientIndex, useMrr, type MrrSummary } from "./queries";

/** Valor de una tarjeta cuya query falló: aviso + reintento de esa query. */
function RetryValue({ query }: { query: UseQueryResult<unknown> }) {
  return (
    <span role="alert" className="flex flex-wrap items-center gap-2 text-base text-danger-strong">
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
 * Franja de KPIs: MRR vs meta, clientes activos y en riesgo. Los cobros próximos
 * y vencidos se resumen en "Próximos cobros" para no repetirlos.
 */
export function KpiStrip() {
  const mrr = useMrr();
  const clients = useClientIndex();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MrrCard query={mrr} />
      <StatCard
        icon={Users}
        label="Clientes activos"
        loading={clients.isPending && !clients.isError}
        value={clients.isError ? <RetryValue query={clients} /> : (clients.data?.activeCount ?? 0)}
      />
      <AtRiskCard />
    </div>
  );
}

function MrrCard({ query }: { query: UseQueryResult<MrrSummary> }) {
  if (query.isError) {
    return (
      <StatCard
        className="sm:col-span-2"
        icon={Target}
        label="MRR actual"
        value={<RetryValue query={query} />}
      />
    );
  }
  const data = query.data;
  const total = data?.total ?? 0;
  const pct = Math.round((total / META_MRR_CLP) * 100);
  const width = Math.min(100, Math.max(0, pct));
  return (
    <StatCard
      className="sm:col-span-2"
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
                className={cn(
                  "block h-full rounded-full",
                  pct >= 100 ? "bg-success" : "bg-primary",
                )}
                style={{ width: `${width}%` }}
              />
            </span>
            <span>
              <span className="font-medium tabular-nums text-foreground">{pct}%</span> de la meta{" "}
              <Money amount={META_MRR_CLP} />
            </span>
            <span>
              Suscripciones <Money amount={data.fromSubscriptions} /> (
              {plural(data.subscriptionClients)}) · Facturación manual{" "}
              <Money amount={data.fromBilling} /> ({plural(data.billingClients)})
            </span>
          </span>
        )
      }
    />
  );
}

/**
 * Clientes en riesgo según "Salud del cliente" (src/lib/health). Los pausados
 * nunca llegan a "En riesgo" (su nivel se limita a Atención), así que no cuentan.
 * Se habilita tras el primer pintado para no competir con los KPIs principales.
 */
function AtRiskCard() {
  const [painted, setPainted] = useState(false);
  useEffect(() => setPainted(true), []);
  const health = useClientsHealth({ enabled: painted });
  const counts = health.data ? countByLevel(health.data.values()) : null;
  const atRisk = counts?.en_riesgo ?? 0;
  return (
    <StatCard
      icon={HeartPulse}
      label="Clientes en riesgo"
      loading={!painted || (health.isPending && !health.isError)}
      value={
        health.isError ? (
          <RetryValue query={health} />
        ) : (
          <span className={cn(atRisk > 0 && "text-danger-strong")}>{atRisk}</span>
        )
      }
      hint={
        counts && (
          <span>
            {counts.atencion} en atención ·{" "}
            <Link
              to="/clients"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Ver clientes
            </Link>
          </span>
        )
      }
    />
  );
}
