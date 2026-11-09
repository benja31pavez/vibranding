import type { ComponentType } from "react";
import {
  BarChart3,
  FileText,
  KeyRound,
  MousePointerClick,
  Plug,
  Target,
  Wallet,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  Panel,
  SectionTabs,
  StatCard,
  StatusBadge,
  type SectionTab,
  type StatusTone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { GoogleAdsBillingPanel } from "./GoogleAdsBillingPanel";
import {
  GOOGLE_ADS_WINDOW_DAYS,
  GoogleAdsCampaignsTable,
  useGoogleAdsCampaigns,
} from "./GoogleAdsCampaignsTable";
import { GoogleAdsConnectCard } from "./GoogleAdsConnectCard";
import { useGoogleAdsHasHistory, useGoogleAdsOverview } from "./googleAdsOverviewQueries";

export type GoogleAdsTab = "resumen" | "campanas" | "palabras-clave" | "anuncios";
export const GOOGLE_ADS_TABS: readonly GoogleAdsTab[] = [
  "resumen",
  "campanas",
  "palabras-clave",
  "anuncios",
];
export function isGoogleAdsTab(v: unknown): v is GoogleAdsTab {
  return typeof v === "string" && (GOOGLE_ADS_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<GoogleAdsTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "campanas", label: "Campañas" },
  { key: "palabras-clave", label: "Palabras clave" },
  { key: "anuncios", label: "Anuncios" },
];

const DESCRIPTION: Readonly<Record<GoogleAdsTab, string>> = {
  resumen: `Conexión, inversión, clics y conversiones de los últimos ${GOOGLE_ADS_WINDOW_DAYS} días`,
  campanas: `Gasto, clics y conversiones por campaña (últimos ${GOOGLE_ADS_WINDOW_DAYS} días)`,
  "palabras-clave": "Términos de búsqueda y palabras clave de las campañas",
  anuncios: "Anuncios de búsqueda y display de las campañas",
};

const INT = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const DEC = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

interface GoogleAdsSectionPageProps {
  clientId: string;
  tab: GoogleAdsTab;
  onTabChange: (tab: GoogleAdsTab) => void;
}

/**
 * Sección Google Ads del cliente con cuatro subsecciones: Resumen (conexión, inversión,
 * clics y conversiones), Campañas (tabla actual y pago de pauta), Palabras clave y
 * Anuncios (pendientes de ingesta: hoy la descarga GAQL guarda solo nivel campaña).
 */
export function GoogleAdsSectionPage({ clientId, tab, onTabChange }: GoogleAdsSectionPageProps) {
  const overview = useGoogleAdsOverview(clientId);
  const history = useGoogleAdsHasHistory(clientId);
  // Campañas y Pago solo se ocultan cuando de verdad no hay nada: overview leído sin conexión
  // y sin métricas guardadas. Si el overview falla, o el token venció, se siguen mostrando.
  const noAccount = overview.isSuccess && !overview.data.connection;
  const noHistory = history.isSuccess && !history.data;
  const showData = !(noAccount && noHistory) && !overview.isLoading;

  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader size="compact" title="Google Ads" description={DESCRIPTION[tab]} />
      <SectionTabs tabs={TABS} value={tab} onChange={onTabChange} label="Vistas de Google Ads" />
    </div>
  );

  const notConnected = (what: string) => (
    <>
      <GoogleAdsConnectCard clientId={clientId} />
      <EmptyState
        icon={Plug}
        title="Google Ads no está conectado"
        description={`${what} aparecen cuando la cuenta de Google Ads del cliente quede vinculada y se descarguen sus métricas.`}
        action={
          <Button variant="outline" onClick={() => onTabChange("resumen")}>
            Volver al resumen
          </Button>
        }
      />
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}
      {tab === "resumen" && (
        <GoogleAdsResumen clientId={clientId} showData={showData} onTabChange={onTabChange} />
      )}
      {tab === "campanas" &&
        (showData ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <GoogleAdsCampaignsTable clientId={clientId} />
            <GoogleAdsBillingPanel clientId={clientId} />
          </div>
        ) : (
          notConnected("Las campañas")
        ))}
      {tab === "palabras-clave" &&
        (showData ? (
          <EmptyState
            icon={KeyRound}
            title="Las palabras clave todavía no se descargan"
            description="La ingesta actual guarda métricas por campaña y día (gasto, clics, conversiones). Para ver palabras clave y términos de búsqueda falta agregar la consulta GAQL de nivel «keyword_view» a la descarga diaria; cuando esté, aparecerán aquí con clics, costo y conversiones."
            action={
              <Button variant="outline" onClick={() => onTabChange("campanas")}>
                Ver campañas
              </Button>
            }
          />
        ) : (
          notConnected("Las palabras clave")
        ))}
      {tab === "anuncios" &&
        (showData ? (
          <EmptyState
            icon={FileText}
            title="Los anuncios todavía no se descargan"
            description="La ingesta actual guarda métricas por campaña y día. Para listar los anuncios (títulos, descripciones y rendimiento) falta agregar la consulta GAQL de nivel «ad_group_ad» a la descarga diaria; cuando esté, aparecerán aquí."
            action={
              <Button variant="outline" onClick={() => onTabChange("campanas")}>
                Ver campañas
              </Button>
            }
          />
        ) : (
          notConnected("Los anuncios")
        ))}
    </div>
  );
}

/* ----------------------------- Resumen ----------------------------- */

const CONNECTION_BADGE: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  conectada: { label: "Conectada", tone: "success" },
  pendiente: { label: "Pendiente", tone: "warning" },
  error: { label: "Con error", tone: "danger" },
  desconectada: { label: "Desconectada", tone: "neutral" },
};

function GoogleAdsResumen({
  clientId,
  showData,
  onTabChange,
}: {
  clientId: string;
  showData: boolean;
  onTabChange: (tab: GoogleAdsTab) => void;
}) {
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

      {showData && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Panel title="Accesos" icon={BarChart3} description="Lo que puedes hacer en esta sección">
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <AccessItem
                icon={BarChart3}
                title="Campañas"
                text="Gasto, clics y conversiones por campaña."
                onClick={() => onTabChange("campanas")}
              />
              <AccessItem
                icon={KeyRound}
                title="Palabras clave"
                text="Se activa con la ingesta de palabras clave."
                onClick={() => onTabChange("palabras-clave")}
              />
              <AccessItem
                icon={FileText}
                title="Anuncios"
                text="Se activa con la ingesta de anuncios."
                onClick={() => onTabChange("anuncios")}
              />
            </ul>
          </Panel>
          <GoogleAdsBillingPanel clientId={clientId} />
        </div>
      )}
    </>
  );
}

function AccessItem({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex h-full w-full flex-col gap-1 rounded-app-md border border-border-subtle bg-surface-2 p-3 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon aria-hidden className="h-4 w-4 text-brand-1" /> {title}
        </span>
        <span className="text-xs text-muted-foreground">{text}</span>
      </button>
    </li>
  );
}
