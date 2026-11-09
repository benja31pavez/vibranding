import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  MessageCircle,
  MousePointerClick,
  Settings2,
  Target,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { MetaIcon } from "@/components/icons/MetaIcon";
import { MetaConnectCard } from "@/components/meta-ads/MetaConnectCard";
import { MetaAdsSectionPage } from "@/components/meta-ads/MetaAdsSectionPage";
import { GoogleAdsConnectCard } from "@/components/google-ads/GoogleAdsConnectCard";
import {
  GOOGLE_ADS_WINDOW_DAYS,
  useGoogleAdsCampaigns,
} from "@/components/google-ads/GoogleAdsCampaignsTable";
import { useGoogleAdsOverview } from "@/components/google-ads/googleAdsOverviewQueries";
import { GoogleAdsSectionPage } from "@/components/google-ads/GoogleAdsSectionPage";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import { chileToday } from "@/lib/dates/chile";

export type AnunciosTab = "resumen" | "meta" | "google" | "configuracion";

export const ANUNCIOS_TABS: readonly AnunciosTab[] = ["resumen", "meta", "google", "configuracion"];

export function isAnunciosTab(v: unknown): v is AnunciosTab {
  return typeof v === "string" && (ANUNCIOS_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<AnunciosTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "meta", label: "Meta Ads" },
  { key: "google", label: "Google Ads" },
  { key: "configuracion", label: "Configuración" },
];

const DESCRIPTION: Readonly<Record<AnunciosTab, string>> = {
  resumen: "Inversión consolidada del mes, clics, conversiones y estado de las conexiones",
  meta: "Conexión, inversión, alertas, campañas y anuncios de Meta Ads en una sola pantalla",
  google: "Conexión, inversión, campañas y anuncios de Google Ads en una sola pantalla",
  configuracion: "Conexiones, cuenta publicitaria Meta, cuenta de Google Ads y presupuestos",
};

const nf = new Intl.NumberFormat("es-CL");

interface AnunciosPageProps {
  clientId: string;
  tab: AnunciosTab;
  onTabChange: (tab: AnunciosTab) => void;
}

/**
 * Sección "Anuncios" del cliente: Meta Ads, Google Ads y configuración común en una
 * sola pantalla con cuatro subsecciones. Meta Ads y Google Ads ya no tienen pestañas
 * internas, es una sola vista continua por plataforma.
 */
export function AnunciosPage({ clientId, tab, onTabChange }: AnunciosPageProps) {
  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader size="compact" title="Anuncios" description={DESCRIPTION[tab]} />
      <SectionTabs tabs={TABS} value={tab} onChange={onTabChange} label="Vistas de Anuncios" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}
      {tab === "resumen" && <AnunciosResumen clientId={clientId} onTabChange={onTabChange} />}
      {tab === "meta" && <MetaAdsSectionPage clientId={clientId} />}
      {tab === "google" && <GoogleAdsSectionPage clientId={clientId} />}
      {tab === "configuracion" && <AnunciosConfiguracion clientId={clientId} />}
    </div>
  );
}

/* ----------------------------- Resumen ----------------------------- */

interface MonthTotals {
  spend: number;
  messages: number;
  clicks: number;
  currency: string | null;
  days: number;
}

function useMetaMonthTotals(clientId: string) {
  const userKey = useUserKey();
  const today = chileToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  return useQuery({
    queryKey: ["anuncios-meta-month-totals", userKey, clientId, monthStart] as const,
    queryFn: async (): Promise<MonthTotals> => {
      const { data, error } = await supabase
        .from("ad_insights_daily")
        .select("date,spend,clicks,messaging_conversations_started,currency")
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
          currency: acc.currency ?? r.currency ?? null,
          days,
        }),
        { spend: 0, messages: 0, clicks: 0, currency: null, days },
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
};

function useMetaAccountStatus(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: ["anuncios-meta-account", userKey, clientId] as const,
    queryFn: async (): Promise<MetaAccountStatus | null> => {
      const { data, error } = await supabase
        .from("meta_accounts")
        .select("connected,token_valid,ad_account_id,business_name,currency")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as MetaAccountStatus | null) ?? null;
    },
  });
}

function metaBadge(acc: MetaAccountStatus | null | undefined): {
  label: string;
  tone: StatusTone;
} {
  if (!acc || !acc.connected) return { label: "Sin conectar", tone: "neutral" };
  if (acc.token_valid === false) return { label: "Token vencido", tone: "danger" };
  if (!acc.ad_account_id) return { label: "Sin cuenta publicitaria", tone: "warning" };
  return { label: "Activa", tone: "success" };
}

const GADS_BADGE: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  conectada: { label: "Conectada", tone: "success" },
  pendiente: { label: "Pendiente", tone: "warning" },
  error: { label: "Con error", tone: "danger" },
  desconectada: { label: "Desconectada", tone: "neutral" },
};

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

function AnunciosResumen({
  clientId,
  onTabChange,
}: {
  clientId: string;
  onTabChange: (tab: AnunciosTab) => void;
}) {
  const metaTotals = useMetaMonthTotals(clientId);
  const metaAcc = useMetaAccountStatus(clientId);
  const gadsOverview = useGoogleAdsOverview(clientId);
  const gadsCampaigns = useGoogleAdsCampaigns(clientId);

  const metaCurrency = metaAcc.data?.currency ?? metaTotals.data?.currency ?? "CLP";
  const metaSpend = metaTotals.data?.spend ?? 0;
  const metaClicks = metaTotals.data?.clicks ?? 0;
  const metaMessages = metaTotals.data?.messages ?? 0;
  const metaHasData = (metaTotals.data?.days ?? 0) > 0;

  const gadsTotals = (gadsCampaigns.data ?? []).reduce(
    (acc, c) => ({
      cost: acc.cost + c.costClp,
      clicks: acc.clicks + c.clicks,
      conv: acc.conv + c.conversions,
    }),
    { cost: 0, clicks: 0, conv: 0 },
  );
  const gadsHasData = (gadsCampaigns.data ?? []).length > 0;
  const gadsConn = gadsOverview.data?.connection ?? null;
  const gadsBadge = gadsConn
    ? (GADS_BADGE[gadsConn.status] ?? { label: gadsConn.status, tone: "neutral" as const })
    : { label: "Sin conectar", tone: "neutral" as const };
  const metaB = metaBadge(metaAcc.data);

  const totalClicks = metaClicks + gadsTotals.clicks;
  const monthLabel = new Date().toLocaleDateString("es-CL", { month: "long" });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-3">
        <StatCard
          label={`Inversión Meta en ${monthLabel}`}
          icon={Wallet}
          loading={metaTotals.isLoading}
          value={metaHasData ? formatMoney(metaSpend, metaCurrency) : "—"}
          hint={
            metaHasData
              ? `${nf.format(metaTotals.data!.days)} ${
                  metaTotals.data!.days === 1 ? "día" : "días"
                } con datos sincronizados`
              : "Sin métricas sincronizadas este mes"
          }
        />
        <StatCard
          label={`Inversión Google (${GOOGLE_ADS_WINDOW_DAYS} días)`}
          icon={Wallet}
          loading={gadsCampaigns.isLoading}
          value={gadsHasData ? <Money amount={gadsTotals.cost} /> : "—"}
          hint={gadsHasData ? "Hasta ayer, en CLP" : "Sin métricas guardadas"}
        />
        <StatCard
          label="Clics (Meta + Google)"
          icon={MousePointerClick}
          loading={metaTotals.isLoading || gadsCampaigns.isLoading}
          value={totalClicks > 0 ? nf.format(totalClicks) : "—"}
          hint={
            totalClicks > 0
              ? `Meta ${nf.format(metaClicks)} · Google ${nf.format(gadsTotals.clicks)}`
              : undefined
          }
        />
        <StatCard
          label="Conversiones y mensajes"
          icon={Target}
          loading={metaTotals.isLoading || gadsCampaigns.isLoading}
          value={
            metaMessages + gadsTotals.conv > 0
              ? `${nf.format(metaMessages)} · ${nf.format(Math.round(gadsTotals.conv))}`
              : "—"
          }
          hint="Mensajes iniciados por Meta · conversiones de Google"
        />
      </div>

      {metaTotals.error && (
        <ErrorState
          title="No pudimos leer las métricas de Meta Ads"
          message={(metaTotals.error as Error).message}
          onRetry={() => void metaTotals.refetch()}
          retrying={metaTotals.isFetching}
        />
      )}
      {gadsCampaigns.error && (
        <ErrorState
          title="No pudimos leer las métricas de Google Ads"
          message={(gadsCampaigns.error as Error).message}
          onRetry={() => void gadsCampaigns.refetch()}
          retrying={gadsCampaigns.isFetching}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-3">
        <StatCard
          label="Meta Ads"
          icon={MetaIcon}
          loading={metaAcc.isLoading}
          value={<StatusBadge status={metaB.label} label={metaB.label} tone={metaB.tone} />}
          hint={
            metaAcc.data?.ad_account_id
              ? `${metaAcc.data.business_name ? `${metaAcc.data.business_name} · ` : ""}${metaAcc.data.ad_account_id}`
              : "Vincula la cuenta en Configuración"
          }
        />
        <StatCard
          label="Google Ads"
          icon={BarChart3}
          loading={gadsOverview.isLoading}
          value={
            <StatusBadge status={gadsBadge.label} label={gadsBadge.label} tone={gadsBadge.tone} />
          }
          hint={gadsConn ? `Cuenta ${gadsConn.customerId}` : "Vincula la cuenta en Configuración"}
        />
      </div>

      <Panel title="Accesos" icon={BarChart3} description="Lo que puedes hacer en Anuncios">
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <AccessItem
            icon={MetaIcon}
            title="Meta Ads"
            text="Métricas, campañas y anuncios de Meta en una sola vista."
            onClick={() => onTabChange("meta")}
          />
          <AccessItem
            icon={BarChart3}
            title="Google Ads"
            text="Métricas, campañas y pago de pauta de Google."
            onClick={() => onTabChange("google")}
          />
          <AccessItem
            icon={Settings2}
            title="Configuración"
            text="Conexiones, cuenta publicitaria y presupuestos."
            onClick={() => onTabChange("configuracion")}
          />
        </ul>
      </Panel>
    </>
  );
}

/* ----------------------------- Configuración ----------------------------- */

function AnunciosConfiguracion({ clientId }: { clientId: string }) {
  return (
    <>
      <MetaConnectCard clientId={clientId} />
      <GoogleAdsConnectCard clientId={clientId} />
      <Panel
        title="Píxel, etiquetas y presupuestos por defecto"
        icon={Settings2}
        description="Todavía no se guardan en la plataforma"
      >
        <EmptyState
          size="compact"
          icon={Settings2}
          title="Sin píxel ni presupuestos por defecto guardados"
          description="Cuando se agreguen estos campos al cliente aparecerán aquí: el píxel de Meta y la etiqueta de Google Ads, más el presupuesto por defecto por plataforma. Por ahora el píxel se administra en el Administrador de eventos de Meta, la etiqueta en Google Tag Manager y el presupuesto se define en cada campaña."
          action={
            <Button asChild size="sm" variant="outline">
              <a
                href="https://business.facebook.com/events_manager2/"
                target="_blank"
                rel="noreferrer"
              >
                Abrir Administrador de eventos
              </a>
            </Button>
          }
        />
      </Panel>
      <Panel
        title="Mensajes y conversaciones por anuncios"
        icon={MessageCircle}
        description="Qué se mide hoy desde cada plataforma"
      >
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Meta:</span> conversaciones iniciadas por
            anuncios Click-to-WhatsApp y Click-to-Messenger (
            <code>messaging_conversations_started</code>).
          </li>
          <li>
            <span className="font-medium text-foreground">Google:</span> conversiones de campaña (
            <code>conversions</code>), sin desglose por acción. El desglose por tipo queda para una
            ingesta futura.
          </li>
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
