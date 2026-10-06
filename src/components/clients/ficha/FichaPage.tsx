import { useActiveClient } from "@/contexts/ActiveClientContext";
import { FitPage } from "@/components/app";
import { AccountCard } from "./AccountCard";
import { ClientHeader } from "./ClientHeader";
import { DocsPanel } from "./DocsPanel";
import { useFichaHealth, useFichaOverview } from "./fichaQueries";
import { HealthHero } from "./HealthHero";
import { StatusStrip } from "./StatusStrip";
import { TimelinePanel } from "./TimelinePanel";
import { WorkPanel } from "./WorkPanel";

/**
 * Ficha del cliente, vista de la agencia, en una pantalla (desde `md`, sin
 * scroll de página): encabezado, franja de estado, salud destacada junto a la
 * cuenta y tres columnas (línea de tiempo, trabajo del mes, documentos y
 * accesos). Las listas se adaptan al alto con `FitList`; formularios y
 * detalle completo se abren en paneles laterales. En móvil todo se apila.
 */
export function FichaPage({ clientId }: { clientId: string }) {
  const { client, ig } = useActiveClient();
  const overview = useFichaOverview(clientId);
  const health = useFichaHealth(clientId);
  const canEdit = Boolean(overview.data?.canEdit);

  const upcomingCount = ig.posts.filter(
    (p) =>
      !(p as { archived_at?: string | null }).archived_at &&
      p.scheduled_at &&
      !p.published_at &&
      new Date(p.scheduled_at).getTime() >= Date.now(),
  ).length;

  return (
    <FitPage
      header={<ClientHeader clientId={clientId} overview={overview.data} />}
      contentClassName="flex flex-col gap-4 md:gap-3"
    >
      <div className="shrink-0">
        <StatusStrip
          clientId={clientId}
          clientName={client?.name ?? ""}
          health={health.data}
          loading={health.isLoading}
          error={health.error}
          onRetry={() => void health.refetch()}
          planKey={overview.data?.billing?.plan_key ?? null}
          canEdit={canEdit}
        />
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-3 md:gap-3">
        <div className="min-w-0 md:col-span-2">
          <HealthHero clientId={clientId} overview={overview.data} />
        </div>
        <AccountCard clientId={clientId} overview={overview} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] md:gap-3 xl:grid-cols-3">
        <TimelinePanel clientId={clientId} />
        {/* Bajo xl, Trabajo y Documentos comparten la segunda columna. */}
        <div className="flex min-w-0 flex-col gap-4 md:min-h-0 md:gap-3 xl:contents">
          <WorkPanel
            clientId={clientId}
            overview={overview.data}
            health={health.data}
            healthLoading={health.isLoading}
            healthError={health.error}
            onRetryHealth={() => void health.refetch()}
            upcomingCount={upcomingCount}
          />
          <DocsPanel clientId={clientId} overview={overview.data} />
        </div>
      </div>
    </FitPage>
  );
}
