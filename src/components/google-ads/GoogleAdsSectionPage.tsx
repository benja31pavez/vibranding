import { FileText, KeyRound, MousePointerClick, Plug, Target, Wallet } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
  type StatusTone,
} from "@/components/app";
import { GoogleAdsBillingPanel } from "./GoogleAdsBillingPanel";
import {
  GOOGLE_ADS_WINDOW_DAYS,
  GoogleAdsCampaignsTable,
  useGoogleAdsCampaigns,
} from "./GoogleAdsCampaignsTable";
import { GoogleAdsConnectCard } from "./GoogleAdsConnectCard";
import { useGoogleAdsHasHistory, useGoogleAdsOverview } from "./googleAdsOverviewQueries";

interface GoogleAdsSectionPageProps {
  clientId: string;
}

/**
 * Sección Google Ads del cliente en una sola pantalla continua: conexión, inversión,
 * clics y conversiones, campañas con pago de pauta, y los pendientes de ingesta
 * (palabras clave y anuncios). Sin pestañas internas.
 */
export function GoogleAdsSectionPage({ clientId }: GoogleAdsSectionPageProps) {
  const overview = useGoogleAdsOverview(clientId);
  const history = useGoogleAdsHasHistory(clientId);
  // Campañas y pago solo se ocultan cuando de verdad no hay nada: overview leído sin conexión
  // y sin métricas guardadas. Si el overview falla, o el token venció, se siguen mostrando.
  const noAccount = overview.isSuccess && !overview.data.connection;
  const noHistory = history.isSuccess && !history.data;
  const showData = !(noAccount && noHistory) && !overview.isLoading;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        size="compact"
        title="Google Ads"
        description={`Conexión, inversión, clics y conversiones de los últimos ${GOOGLE_ADS_WINDOW_DAYS} días, campañas y anuncios en una sola pantalla`}
      />
      <GoogleAdsUnificada clientId={clientId} showData={showData} />
    </div>
  );
}

const CONNECTION_BADGE: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  conectada: { label: "Conectada", tone: "success" },
  pendiente: { label: "Pendiente", tone: "warning" },
  error: { label: "Con error", tone: "danger" },
  desconectada: { label: "Desconectada", tone: "neutral" },
};

const INT = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const DEC = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

function GoogleAdsUnificada({ clientId, showData }: { clientId: string; showData: boolean }) {
  const overview = useGoogleAdsOverview(clientId);
  const campaigns = useGoogleAdsCampaigns(clientId);
  const conn = overview.data?.connection ?? null;
  const badge = conn
    ? (CONNECTION_BADGE[conn.status] ?? { label: conn.status, tone: "neutral" as const })
    : { label: "Sin conectar", tone: "neutral" as const };

  const totals = (campaigns.data ?? []).reduce(
    (acc, c) => ({
      cost: acc.cost + c.costClp,
      clicks: acc.clicks + c.clicks,
      conv: acc.conv + c.conversions,
    }),
    { cost: 0, clicks: 0, conv: 0 },
  );
  const hasRows = (campaigns.data ?? []).length > 0;

  return (
    <>
      <GoogleAdsConnectCard clientId={clientId} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-3">
        <StatCard
          label="Conexión"
          icon={Plug}
          loading={overview.isLoading}
          value={<StatusBadge status={badge.label} label={badge.label} tone={badge.tone} />}
          hint={
            conn
              ? `Cuenta ${conn.customerId}${conn.lastSyncedAt ? ` · sincronizada ${new Date(conn.lastSyncedAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}`
              : "Vincula la cuenta desde la tarjeta de arriba"
          }
        />
        <StatCard
          label={`Inversión (${GOOGLE_ADS_WINDOW_DAYS} días)`}
          icon={Wallet}
          loading={campaigns.isLoading}
          value={hasRows ? <Money amount={totals.cost} /> : "—"}
          hint={hasRows ? "Hasta ayer, en CLP" : "Sin métricas guardadas"}
        />
        <StatCard
          label="Clics"
          icon={MousePointerClick}
          loading={campaigns.isLoading}
          value={hasRows ? INT.format(totals.clicks) : "—"}
          hint={
            hasRows
              ? `${INT.format((campaigns.data ?? []).length)} ${(campaigns.data ?? []).length === 1 ? "campaña" : "campañas"} con datos`
              : undefined
          }
        />
        <StatCard
          label="Conversiones"
          icon={Target}
          loading={campaigns.isLoading}
          value={hasRows ? DEC.format(totals.conv) : "—"}
          hint={
            hasRows && totals.conv > 0 ? (
              <>
                Costo por conversión: <Money amount={Math.round(totals.cost / totals.conv)} />
              </>
            ) : undefined
          }
        />
      </div>

      {campaigns.error && (
        <ErrorState
          title="No pudimos leer las métricas de Google Ads"
          message={(campaigns.error as Error).message}
          onRetry={() => void campaigns.refetch()}
          retrying={campaigns.isFetching}
        />
      )}

      {showData ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <GoogleAdsCampaignsTable clientId={clientId} />
            <GoogleAdsBillingPanel clientId={clientId} />
          </div>
          <Panel
            title="Palabras clave"
            icon={KeyRound}
            description="Se activarán cuando la descarga diaria incluya nivel keyword_view"
          >
            <EmptyState
              size="compact"
              icon={KeyRound}
              title="Las palabras clave todavía no se descargan"
              description="La ingesta actual guarda métricas por campaña y día (gasto, clics, conversiones). Para ver palabras clave y términos de búsqueda falta agregar la consulta GAQL de nivel «keyword_view» a la descarga diaria; cuando esté, aparecerán aquí con clics, costo y conversiones."
            />
          </Panel>
          <Panel
            title="Anuncios"
            icon={FileText}
            description="Se activarán cuando la descarga diaria incluya nivel ad_group_ad"
          >
            <EmptyState
              size="compact"
              icon={FileText}
              title="Los anuncios todavía no se descargan"
              description="La ingesta actual guarda métricas por campaña y día. Para listar los anuncios (títulos, descripciones y rendimiento) falta agregar la consulta GAQL de nivel «ad_group_ad» a la descarga diaria; cuando esté, aparecerán aquí."
            />
          </Panel>
        </>
      ) : (
        <EmptyState
          icon={Plug}
          title="Google Ads no está conectado"
          description="Las campañas, palabras clave y anuncios aparecen cuando la cuenta de Google Ads del cliente quede vinculada y se descarguen sus métricas."
        />
      )}
    </>
  );
}
