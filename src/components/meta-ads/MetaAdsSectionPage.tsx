import type { ComponentType, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BellRing,
  Image as ImageIcon,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Plug,
  Settings2,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  SectionTabs,
  StatCard,
  StatusBadge,
  TableSkeleton,
  type SectionTab,
  type StatusTone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CampaignAlertsPanel } from "@/components/clients/ficha/CampaignAlertsPanel";
import {
  useFichaHealth,
  useFichaOverview,
  useUserKey,
} from "@/components/clients/ficha/fichaQueries";
import { MetaAdsPanel } from "@/components/MetaAdsPanel";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { chileToday } from "@/lib/dates/chile";
import { MetaConnectCard } from "./MetaConnectCard";

export type MetaAdsTab = "resumen" | "campanas" | "anuncios" | "configuracion";
export const META_ADS_TABS: readonly MetaAdsTab[] = [
  "resumen",
  "campanas",
  "anuncios",
  "configuracion",
];
export function isMetaAdsTab(v: unknown): v is MetaAdsTab {
  return typeof v === "string" && (META_ADS_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<MetaAdsTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "campanas", label: "Campañas" },
  { key: "anuncios", label: "Anuncios" },
  { key: "configuracion", label: "Configuración" },
];

const DESCRIPTION: Readonly<Record<MetaAdsTab, string>> = {
  resumen: "Inversión del mes, resultados, estado de la cuenta y alertas",
  campanas: "Campañas, conjuntos de anuncios y métricas sincronizadas desde Meta",
  anuncios: "Todos los anuncios del cliente, con su campaña y estado",
  configuracion: "Conexión con Meta, cuenta publicitaria, página e Instagram vinculados",
};

const nf = new Intl.NumberFormat("es-CL");

/** Monto en la moneda de la cuenta publicitaria (Meta puede trabajar en USD u otra). */
function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "CLP" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${nf.format(Math.round(amount))} ${currency}`;
  }
}

interface MetaAdsSectionPageProps {
  clientId: string;
  tab: MetaAdsTab;
  onTabChange: (tab: MetaAdsTab) => void;
}

/**
 * Sección Meta Ads del cliente con cuatro subsecciones: Resumen (inversión del mes,
 * mensajes, estado de cuenta y alertas), Campañas (panel actual), Anuncios (lista plana
 * de anuncios guardados) y Configuración (conexión y activos vinculados).
 */
export function MetaAdsSectionPage({ clientId, tab, onTabChange }: MetaAdsSectionPageProps) {
  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader size="compact" title="Meta Ads" description={DESCRIPTION[tab]} />
      <SectionTabs tabs={TABS} value={tab} onChange={onTabChange} label="Vistas de Meta Ads" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}
      {tab === "resumen" && <MetaAdsResumen clientId={clientId} onTabChange={onTabChange} />}
      {tab === "campanas" && (
        <NeedsConnection clientId={clientId} onTabChange={onTabChange} what="Las campañas">
          <MetaAdsPanel clientId={clientId} section="campanas" />
        </NeedsConnection>
      )}
      {tab === "anuncios" && (
        <NeedsConnection clientId={clientId} onTabChange={onTabChange} what="Los anuncios">
          <MetaAdsAnuncios clientId={clientId} onTabChange={onTabChange} />
        </NeedsConnection>
      )}
      {tab === "configuracion" && (
        <>
          <MetaConnectCard clientId={clientId} />
          <MetaAdsPanel clientId={clientId} section="configuracion" />
          <Panel
            title="Píxel y presupuesto por defecto"
            icon={Settings2}
            description="Todavía no se guardan en la plataforma"
          >
            <EmptyState
              size="compact"
              icon={Settings2}
              title="Sin píxel ni presupuesto por defecto guardados"
              description="Cuando se agreguen estos campos a la cuenta de Meta del cliente aparecerán aquí. Por ahora el presupuesto se define en cada campaña y el píxel se administra en el Administrador de eventos de Meta."
              action={
                <Button size="sm" variant="outline" onClick={() => onTabChange("campanas")}>
                  Ir a Campañas
                </Button>
              }
            />
          </Panel>
        </>
      )}
    </div>
  );
}

/**
 * Sin cuenta publicitaria vinculada, el panel de campañas no dibuja nada a propósito;
 * aquí explicamos qué falta y llevamos a Configuración.
 */
function NeedsConnection({
  clientId,
  onTabChange,
  what,
  children,
}: {
  clientId: string;
  onTabChange: (tab: MetaAdsTab) => void;
  what: string;
  children: ReactNode;
}) {
  const { caps, loading, error } = useClientCapabilities(clientId);
  if (!loading && !error && !caps.meta_connected && !caps.has_ad_account) {
    return (
      <EmptyState
        icon={Plug}
        title="Meta Ads no está conectado"
        description={`${what} aparecen cuando el cliente tenga una cuenta de Meta conectada y una cuenta publicitaria vinculada.`}
        action={<Button onClick={() => onTabChange("configuracion")}>Ir a Configuración</Button>}
      />
    );
  }
  return <>{children}</>;
}

/* ----------------------------- Resumen ----------------------------- */

interface MonthTotals {
  spend: number;
  messages: number;
  clicks: number;
  impressions: number;
  currency: string | null;
  days: number;
}

function useMetaMonthTotals(clientId: string) {
  const userKey = useUserKey();
  const today = chileToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  return useQuery({
    queryKey: ["meta-ads-month-totals", userKey, clientId, monthStart] as const,
    queryFn: async (): Promise<MonthTotals> => {
      const { data, error } = await supabase
        .from("ad_insights_daily")
        .select("date,spend,clicks,impressions,messaging_conversations_started,currency")
        .eq("client_id", clientId)
        .eq("level", "ad")
        .gte("date", monthStart)
        .lte("date", today)
        .limit(5000);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const days = new Set(rows.map((r) => r.date)).size;
      return rows.reduce<MonthTotals>(
        (acc, r) => ({
          spend: acc.spend + Number(r.spend ?? 0),
          messages: acc.messages + (r.messaging_conversations_started ?? 0),
          clicks: acc.clicks + (r.clicks ?? 0),
          impressions: acc.impressions + (r.impressions ?? 0),
          currency: acc.currency ?? r.currency ?? null,
          days,
        }),
        { spend: 0, messages: 0, clicks: 0, impressions: 0, currency: null, days },
      );
    },
  });
}

type MetaAccountStatus = {
  connected: boolean;
  token_valid: boolean | null;
  ad_account_id: string | null;
  business_name: string | null;
  currency: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
};

function useMetaAccountStatus(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: ["meta-account-status", userKey, clientId] as const,
    queryFn: async (): Promise<MetaAccountStatus | null> => {
      const { data, error } = await supabase
        .from("meta_accounts")
        .select(
          "connected,token_valid,ad_account_id,business_name,currency,last_synced_at,last_sync_error",
        )
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as MetaAccountStatus | null) ?? null;
    },
  });
}

function accountBadge(acc: MetaAccountStatus | null | undefined): {
  label: string;
  tone: StatusTone;
} {
  if (!acc || !acc.connected) return { label: "Sin conectar", tone: "neutral" };
  if (acc.token_valid === false) return { label: "Token vencido", tone: "danger" };
  if (!acc.ad_account_id) return { label: "Sin cuenta publicitaria", tone: "warning" };
  if (acc.last_sync_error) return { label: "Error al sincronizar", tone: "warning" };
  return { label: "Activa", tone: "success" };
}

function MetaAdsResumen({
  clientId,
  onTabChange,
}: {
  clientId: string;
  onTabChange: (tab: MetaAdsTab) => void;
}) {
  const totals = useMetaMonthTotals(clientId);
  const account = useMetaAccountStatus(clientId);
  const health = useFichaHealth(clientId);
  const overview = useFichaOverview(clientId);
  const monthLabel = new Date().toLocaleDateString("es-CL", { month: "long" });
  const currency = account.data?.currency ?? totals.data?.currency ?? "CLP";
  const metaAlerts = (health.data?.alerts ?? []).filter((a) => a.platform === "meta");
  const badge = accountBadge(account.data);

  return (
    <>
      <MetaConnectCard clientId={clientId} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-3">
        <StatCard
          label={`Inversión en ${monthLabel}`}
          icon={Wallet}
          loading={totals.isLoading}
          value={
            totals.data && totals.data.days > 0 ? formatMoney(totals.data.spend, currency) : "—"
          }
          hint={
            totals.data && totals.data.days > 0
              ? `${nf.format(totals.data.days)} ${totals.data.days === 1 ? "día" : "días"} con datos sincronizados`
              : "Sin métricas sincronizadas este mes"
          }
        />
        <StatCard
          label="Conversaciones iniciadas"
          icon={MessageCircle}
          loading={totals.isLoading}
          value={totals.data && totals.data.days > 0 ? nf.format(totals.data.messages) : "—"}
          hint="Mensajes que partieron desde un anuncio"
        />
        <StatCard
          label="Clics"
          icon={MousePointerClick}
          loading={totals.isLoading}
          value={totals.data && totals.data.days > 0 ? nf.format(totals.data.clicks) : "—"}
          hint={
            totals.data && totals.data.days > 0
              ? `${nf.format(totals.data.impressions)} impresiones`
              : undefined
          }
        />
        <StatCard
          label="Cuenta publicitaria"
          icon={Plug}
          loading={account.isLoading}
          value={<StatusBadge status={badge.label} label={badge.label} tone={badge.tone} />}
          hint={
            account.data?.ad_account_id
              ? `${account.data.business_name ? `${account.data.business_name} · ` : ""}${account.data.ad_account_id}`
              : "Vincúlala en Configuración"
          }
        />
      </div>

      {totals.error && (
        <ErrorState
          title="No pudimos leer las métricas del mes"
          message={(totals.error as Error).message}
          onRetry={() => void totals.refetch()}
          retrying={totals.isFetching}
        />
      )}

      {health.error ? (
        <ErrorState
          title="No pudimos revisar las alertas de campañas"
          message={(health.error as Error).message}
          onRetry={() => void health.refetch()}
          retrying={health.isFetching}
        />
      ) : metaAlerts.length > 0 ? (
        <CampaignAlertsPanel alerts={metaAlerts} canEdit={Boolean(overview.data?.canEdit)} />
      ) : (
        <Panel title="Alertas de campañas" icon={BellRing}>
          <EmptyState
            size="compact"
            icon={BellRing}
            title={health.isLoading ? "Revisando alertas…" : "Sin alertas abiertas en Meta Ads"}
            description="Las alertas automáticas (gasto sin resultados, pago rechazado, campañas detenidas) aparecen aquí."
          />
        </Panel>
      )}

      <Panel title="Accesos" icon={Megaphone} description="Lo que puedes hacer en esta sección">
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <AccessItem
            icon={Megaphone}
            title="Campañas"
            text="Crear, publicar y editar campañas, conjuntos y anuncios."
            onClick={() => onTabChange("campanas")}
          />
          <AccessItem
            icon={ImageIcon}
            title="Anuncios"
            text="Lista de todos los anuncios con su estado."
            onClick={() => onTabChange("anuncios")}
          />
          <AccessItem
            icon={Settings2}
            title="Configuración"
            text="Conexión, cuenta publicitaria, página e Instagram."
            onClick={() => onTabChange("configuracion")}
          />
        </ul>
      </Panel>
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

/* ----------------------------- Anuncios ----------------------------- */

type AdRow = {
  id: string;
  name: string;
  status: string;
  format: string;
  placement: string;
  headline: string | null;
  image_url: string | null;
  fb_ad_id: string | null;
  adset_id: string;
};

const AD_STATUS: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  ACTIVE: { label: "Activo", tone: "success" },
  PAUSED: { label: "Pausado", tone: "warning" },
  DRAFT: { label: "Borrador", tone: "neutral" },
  ARCHIVED: { label: "Archivado", tone: "neutral" },
  DELETED: { label: "Eliminado", tone: "danger" },
};

const FORMAT_LABEL: Readonly<Record<string, string>> = {
  image: "Imagen",
  video: "Video",
  carousel: "Carrusel",
};

const PLACEMENT_LABEL: Readonly<Record<string, string>> = {
  feed: "Feed",
  stories: "Historias",
  reels: "Reels",
  marketplace: "Marketplace",
  search: "Búsqueda",
  audience_network: "Audience Network",
};

function MetaAdsAnuncios({
  clientId,
  onTabChange,
}: {
  clientId: string;
  onTabChange: (tab: MetaAdsTab) => void;
}) {
  const userKey = useUserKey();
  const query = useQuery({
    queryKey: ["meta-ads-ads-list", userKey, clientId] as const,
    queryFn: async () => {
      const [adsRes, adsetsRes, campaignsRes] = await Promise.all([
        supabase
          .from("meta_ads_ads")
          .select("id,name,status,format,placement,headline,image_url,fb_ad_id,adset_id")
          .eq("client_id", clientId)
          .order("position"),
        supabase.from("meta_ads_adsets").select("id,name,campaign_id").eq("client_id", clientId),
        supabase.from("meta_ads_campaigns").select("id,name").eq("client_id", clientId),
      ]);
      const firstError = adsRes.error ?? adsetsRes.error ?? campaignsRes.error;
      if (firstError) throw new Error(firstError.message);
      const campaigns = new Map((campaignsRes.data ?? []).map((c) => [c.id, c.name]));
      const adsets = new Map(
        (adsetsRes.data ?? []).map((a) => [
          a.id,
          { name: a.name, campaign: campaigns.get(a.campaign_id) ?? "—" },
        ]),
      );
      return ((adsRes.data ?? []) as AdRow[]).map((ad) => ({
        ...ad,
        adsetName: adsets.get(ad.adset_id)?.name ?? "—",
        campaignName: adsets.get(ad.adset_id)?.campaign ?? "—",
      }));
    },
  });

  return (
    <Panel
      title="Anuncios"
      icon={ImageIcon}
      description="Anuncios guardados en la plataforma, agrupados por conjunto y campaña"
      actions={
        <Button size="sm" variant="outline" onClick={() => onTabChange("campanas")}>
          Editar en Campañas
        </Button>
      }
    >
      {query.isLoading ? (
        <TableSkeleton rows={4} columns={6} label="Cargando anuncios" />
      ) : query.error ? (
        <ErrorState
          message={(query.error as Error).message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          size="compact"
          icon={ImageIcon}
          title="Aún no hay anuncios"
          description="Los anuncios se crean dentro de cada conjunto en Campañas (o con el asistente «Crear campaña en Meta»)."
          action={
            <Button size="sm" onClick={() => onTabChange("campanas")}>
              Ir a Campañas
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anuncio</TableHead>
                <TableHead>Conjunto</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data ?? []).map((ad) => {
                const st = AD_STATUS[ad.status] ?? { label: ad.status, tone: "neutral" as const };
                return (
                  <TableRow key={ad.id}>
                    <TableCell className="max-w-[280px]">
                      <div className="flex items-center gap-2">
                        {ad.image_url ? (
                          <img
                            src={ad.image_url}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-app-sm object-cover"
                          />
                        ) : (
                          <div
                            className="h-9 w-9 shrink-0 rounded-app-sm bg-surface-2"
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium" title={ad.name}>
                            {ad.name}
                          </p>
                          {ad.headline && (
                            <p className="truncate text-xs text-muted-foreground">{ad.headline}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={ad.adsetName}>
                      {ad.adsetName}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={ad.campaignName}>
                      {ad.campaignName}
                    </TableCell>
                    <TableCell>{FORMAT_LABEL[ad.format] ?? ad.format}</TableCell>
                    <TableCell>{PLACEMENT_LABEL[ad.placement] ?? ad.placement}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={ad.status} label={st.label} tone={st.tone} />
                        <span className="text-xs text-muted-foreground">
                          {ad.fb_ad_id ? "Publicado en Meta" : "Solo local"}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
