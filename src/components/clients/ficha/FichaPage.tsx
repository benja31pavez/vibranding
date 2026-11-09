import { useActiveClient } from "@/contexts/ActiveClientContext";
import { FitPage, SectionTabs, type SectionTab } from "@/components/app";
import { AccountCard } from "./AccountCard";
import { BrandKitPanel } from "./BrandKitPanel";
import { ClientHeader } from "./ClientHeader";
import { DocsPanel } from "./DocsPanel";
import { useFichaHealth, useFichaOverview } from "./fichaQueries";
import { HealthHero } from "./HealthHero";
import { NextPublicationPanel, SocialAndAdsPanel } from "./ResumenExtras";
import { StatusStrip } from "./StatusStrip";
import { TimelinePanel } from "./TimelinePanel";
import { WorkPanel } from "./WorkPanel";

export type PanelTab = "resumen" | "kit" | "bitacora" | "configuracion";
export const PANEL_TABS: readonly PanelTab[] = ["resumen", "kit", "bitacora", "configuracion"];
export function isPanelTab(v: unknown): v is PanelTab {
  return typeof v === "string" && (PANEL_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<PanelTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "kit", label: "Kit de marca" },
  { key: "bitacora", label: "Bitácora" },
  { key: "configuracion", label: "Configuración" },
];

interface FichaPageProps {
  clientId: string;
  tab?: PanelTab;
  onTabChange?: (tab: PanelTab) => void;
}

/**
 * Panel del cliente (vista de la agencia) con cuatro subsecciones:
 * - Resumen: cuenta y salud arriba, franja de estado (entregas, pagos, campañas, pauta)
 *   y abajo trabajo del mes, redes y campañas y próxima publicación. En `md` cabe en
 *   una pantalla; en móvil todo se apila.
 * - Kit de marca: logo, paleta, perfil y archivos.
 * - Bitácora: línea de tiempo completa y documentos.
 * - Configuración: acceso al portal, onboarding y descripción del negocio.
 */
export function FichaPage({ clientId, tab = "resumen", onTabChange }: FichaPageProps) {
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

  const header = (
    <div className="flex flex-col gap-3">
      <ClientHeader clientId={clientId} overview={overview.data} />
      <SectionTabs
        tabs={TABS}
        value={tab}
        onChange={(next) => onTabChange?.(next)}
        label="Vistas del panel"
      />
    </div>
  );

  if (tab === "kit") {
    return (
      <FitPage header={header} scroll contentClassName="flex flex-col gap-4 md:gap-3">
        <BrandKitPanel clientId={clientId} />
      </FitPage>
    );
  }

  if (tab === "bitacora") {
    return (
      <FitPage header={header} contentClassName="flex flex-col gap-4 md:gap-3">
        <div className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-cols-3 md:grid-rows-[minmax(0,1fr)] md:gap-3">
          <div className="min-w-0 md:col-span-2 md:min-h-0">
            <TimelinePanel clientId={clientId} />
          </div>
          <DocsPanel
            clientId={clientId}
            overview={overview.data}
            group="documentos"
            title="Documentos"
          />
        </div>
      </FitPage>
    );
  }

  if (tab === "configuracion") {
    return (
      <FitPage header={header} contentClassName="flex flex-col gap-4 md:gap-3">
        <div className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-cols-3 md:grid-rows-[minmax(0,1fr)] md:gap-3">
          <div className="min-w-0 md:col-span-2 md:min-h-0">
            <DocsPanel
              clientId={clientId}
              overview={overview.data}
              group="configuracion"
              title="Acceso, onboarding y datos del negocio"
            />
          </div>
          <AccountCard clientId={clientId} overview={overview} />
        </div>
      </FitPage>
    );
  }

  return (
    <FitPage header={header} contentClassName="flex flex-col gap-4 md:gap-3">
      {/* Fila 1: indicadores grandes (cuenta y salud accionable). */}
      <div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-3 md:gap-3">
        <AccountCard clientId={clientId} overview={overview} />
        <div className="min-w-0 md:col-span-2">
          <HealthHero clientId={clientId} overview={overview.data} />
        </div>
      </div>

      {/* Fila 2: entregas, pagos, campañas, salud y pago de pauta. */}
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

      {/* Fila 3: trabajo del mes, redes y campañas, próxima publicación. */}
      <div className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] md:gap-3 xl:grid-cols-3">
        <WorkPanel
          clientId={clientId}
          overview={overview.data}
          health={health.data}
          healthLoading={health.isLoading}
          healthError={health.error}
          onRetryHealth={() => void health.refetch()}
          upcomingCount={upcomingCount}
        />
        {/* Bajo xl, redes y próxima publicación comparten la segunda columna. */}
        <div className="flex min-w-0 flex-col gap-4 md:min-h-0 md:gap-3 xl:contents">
          <SocialAndAdsPanel clientId={clientId} />
          <NextPublicationPanel clientId={clientId} />
        </div>
      </div>
    </FitPage>
  );
}
