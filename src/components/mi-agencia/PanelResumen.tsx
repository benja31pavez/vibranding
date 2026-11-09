import { AlertTriangle, DollarSign, Pause, PlayCircle, UserPlus, Users } from "lucide-react";
import { ErrorState, Money, Panel, StatCard } from "@/components/app";
import { useMrr } from "@/lib/billing/mrr";
import { useClientsSummary, type CurrentOrg } from "@/lib/agency/queries";

/**
 * Resumen de la agencia: suma la info que ya calcula la plataforma (MRR, cliente
 * por etapa). Nada inventado: si una cifra no se puede calcular, se muestra 0 o
 * un estado vacío honesto.
 */
export function PanelResumen({ org }: { org: CurrentOrg }) {
  const mrr = useMrr();
  const summary = useClientsSummary(org.orgId);

  const mrrValue = mrr.data?.total ?? 0;
  const activos = summary.data?.activos ?? 0;
  const onboarding = summary.data?.onboarding ?? 0;
  const pausados = summary.data?.pausados ?? 0;
  const prospectos = summary.data?.prospectos ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {(mrr.error || summary.error) && (
        <ErrorState
          message={
            mrr.error?.message ?? summary.error?.message ?? "No pudimos cargar algunos datos."
          }
          onRetry={() => {
            void mrr.refetch();
            void summary.refetch();
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="MRR neto (sin IVA)"
          icon={DollarSign}
          loading={mrr.isLoading}
          value={<Money amount={mrrValue} />}
          hint={
            mrr.data
              ? `${mrr.data.subscriptionClients + mrr.data.billingClients} clientes aportan`
              : undefined
          }
        />
        <StatCard
          label="Clientes activos"
          icon={PlayCircle}
          loading={summary.isLoading}
          value={activos}
          hint={summary.data ? `${summary.data.total} en total` : undefined}
        />
        <StatCard
          label="En onboarding"
          icon={UserPlus}
          loading={summary.isLoading}
          value={onboarding}
        />
        <StatCard
          label="En riesgo"
          icon={AlertTriangle}
          loading={summary.isLoading}
          value={pausados}
          hint="clientes pausados"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Panel
          icon={Users}
          title="Cartera de clientes"
          description="Clientes de tu agencia por etapa."
        >
          {summary.data && summary.data.total > 0 ? (
            <dl className="divide-y divide-border-subtle">
              <Row label="Activos" value={activos} />
              <Row label="En onboarding" value={onboarding} />
              <Row label="Prospectos" value={prospectos} />
              <Row label="Pausados" value={pausados} />
              <Row label="Terminados" value={summary.data.terminados} />
              <Row label="Total" value={summary.data.total} bold />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no has registrado clientes. Cuando agregues alguno en Clientes, el resumen se arma
              solo.
            </p>
          )}
        </Panel>
        <Panel icon={Pause} title="Alertas abiertas" description="Resumen agregado de la agencia.">
          <p className="text-sm text-muted-foreground">
            Las alertas por cliente viven en el panel de cada uno. Aquí verás un resumen agregado
            cuando se conecte la vista cruzada.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={`tabular-nums ${bold ? "text-base font-semibold text-foreground" : "text-sm font-medium"}`}
      >
        {value}
      </dd>
    </div>
  );
}
