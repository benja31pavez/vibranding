import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import {
  BadgeDollarSign,
  ExternalLink,
  Eye,
  MessageCircle,
  MousePointerClick,
  Search,
  Target,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CompactStats,
  ErrorState,
  FitPage,
  Money,
  PageHeader,
  Panel,
  StatusBadge,
  type CompactStat,
} from "@/components/app";
import { MetaIcon } from "@/components/icons/MetaIcon";
import { cn } from "@/lib/utils";
import {
  ADS_PERIODS,
  BILLING_HELP_URL,
  BILLING_STATE,
  CAMPAIGN_STATUS,
  DEFAULT_ADS_PERIOD,
  PLATFORM_COPY,
  formatCount,
  syncedAgo,
  type AdsCampaign,
  type AdsPeriod,
  type AdsPlatformKey,
  type ClientAdsSummary,
} from "./adsModel";
import { OneLineState } from "./OneLineState";
import { useClientAds } from "./useClientAds";

type Connected = Extract<ClientAdsSummary, { connected: true }>;

const PLATFORM_ICON: Record<AdsPlatformKey, ComponentType<{ className?: string }>> = {
  meta: MetaIcon,
  google: Search,
};

/**
 * Publicidad del cliente (solo lectura; controlar campañas es la Fase 3).
 * Resumen del período, campañas y estado del pago de su pauta. Nunca muestra
 * ids de cuentas, tokens, la MCC ni alertas internas (el RPC no los devuelve).
 */
export function AdsPage({ platform }: { platform: AdsPlatformKey }) {
  const [days, setDays] = useState<AdsPeriod>(DEFAULT_ADS_PERIOD);
  const ads = useClientAds(platform, days);
  const copy = PLATFORM_COPY[platform];
  const data = ads.data;

  const periodPicker =
    data?.connected === true ? (
      <PeriodPicker value={days} onChange={setDays} busy={ads.isFetching} />
    ) : undefined;

  let body: ReactNode;
  if (ads.isError) {
    body = (
      <ErrorState
        title="No pudimos cargar tu publicidad."
        onRetry={() => void ads.refetch()}
        retrying={ads.isFetching}
      />
    );
  } else if (ads.isPending) {
    body = (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full rounded-app-lg" />
        <Skeleton className="h-64 w-full rounded-app-lg" />
      </div>
    );
  } else if (!data || !data.connected) {
    body = (
      <OneLineState
        icon={PLATFORM_ICON[platform]}
        text="Tu equipo VIBRANDING lo está configurando."
      />
    );
  } else {
    body = <ConnectedView platform={platform} data={data} />;
  }

  return (
    <FitPage header={<PageHeader size="compact" title={copy.title} actions={periodPicker} />}>
      <div className="flex flex-col gap-4 md:h-full md:min-h-0">{body}</div>
    </FitPage>
  );
}

function PeriodPicker({
  value,
  onChange,
  busy,
}: {
  value: AdsPeriod;
  onChange: (d: AdsPeriod) => void;
  busy: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Período"
      aria-busy={busy}
      className="flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
    >
      {ADS_PERIODS.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={value === d}
          onClick={() => onChange(d)}
          className={cn(
            "whitespace-nowrap rounded-md px-3 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === d
              ? "bg-background text-foreground shadow"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {d} días
        </button>
      ))}
    </div>
  );
}

function ConnectedView({ platform, data }: { platform: AdsPlatformKey; data: Connected }) {
  const copy = PLATFORM_COPY[platform];
  const { totals, currency } = data;
  const stats: CompactStat[] = [
    {
      key: "spend",
      label: "Inversión",
      icon: Wallet,
      value: <Money amount={totals.spend} currency={currency} />,
    },
    totals.reach !== null
      ? { key: "reach", label: "Alcance", icon: Eye, value: formatCount(totals.reach) }
      : { key: "impr", label: "Impresiones", icon: Eye, value: formatCount(totals.impressions) },
    { key: "clicks", label: "Clics", icon: MousePointerClick, value: formatCount(totals.clicks) },
    {
      key: "results",
      label: copy.results,
      icon: platform === "meta" ? MessageCircle : Target,
      value: formatCount(totals.results),
    },
    {
      key: "cpr",
      label: "Costo por resultado",
      icon: BadgeDollarSign,
      value:
        totals.costPerResult !== null ? (
          <Money amount={totals.costPerResult} currency={currency} />
        ) : (
          "—"
        ),
    },
  ];

  return (
    <>
      <CompactStats
        items={stats}
        label={`Resumen de ${copy.title}`}
        className="grid-flow-row grid-cols-2 divide-x-0 sm:grid-flow-col sm:grid-cols-none sm:divide-x"
      />
      <BillingLine platform={platform} data={data} />
      <Panel title="Campañas" fill className="md:min-h-0 md:flex-1">
        {data.campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin campañas con actividad en este período.
          </p>
        ) : (
          <CampaignsTable platform={platform} campaigns={data.campaigns} currency={currency} />
        )}
      </Panel>
    </>
  );
}

function BillingLine({ platform, data }: { platform: AdsPlatformKey; data: Connected }) {
  const state = BILLING_STATE[data.billingState];
  const synced = syncedAgo(data.lastSyncedAt);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <StatusBadge status={data.billingState} label={state.label} tone={state.tone} />
      {data.billingDetail && <span className="text-muted-foreground">{data.billingDetail}</span>}
      {data.billingState === "rechazado" && (
        <a
          href={BILLING_HELP_URL[platform]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          Revisar mi medio de pago <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
      {synced && <span className="ml-auto text-xs text-muted-foreground">{synced}</span>}
    </div>
  );
}

function CampaignsTable({
  platform,
  campaigns,
  currency,
}: {
  platform: AdsPlatformKey;
  campaigns: AdsCampaign[];
  currency: string;
}) {
  const copy = PLATFORM_COPY[platform];
  const reachLabel = platform === "meta" ? "Alcance" : "Impresiones";
  const th = "px-3 py-2 text-right font-medium";
  const td = "px-3 py-2.5 text-right tabular-nums";
  return (
    <div className="overflow-x-auto md:h-full md:min-h-0 md:overflow-y-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="sticky top-0 z-10 bg-surface text-xs text-muted-foreground">
          <tr className="border-b border-border-subtle">
            <th className="px-3 py-2 text-left font-medium">Campaña</th>
            <th className="px-3 py-2 text-left font-medium">Estado</th>
            <th className={th}>Inversión</th>
            <th className={th}>{reachLabel}</th>
            <th className={th}>Clics</th>
            <th className={th} title={copy.resultsHint}>
              {copy.results}
            </th>
            <th className={th}>Costo por resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {campaigns.map((c, i) => {
            const status = CAMPAIGN_STATUS[c.status];
            return (
              <tr key={`${c.name}-${i}`}>
                <td className="max-w-[280px] truncate px-3 py-2.5 font-medium" title={c.name}>
                  {c.name}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={c.status} label={status.label} tone={status.tone} />
                </td>
                <td className={td}>
                  <Money amount={c.spend} currency={currency} />
                </td>
                <td className={td}>{formatCount(c.reach ?? c.impressions)}</td>
                <td className={td}>{formatCount(c.clicks)}</td>
                <td className={td}>{formatCount(c.results)}</td>
                <td className={td}>
                  {c.costPerResult !== null ? (
                    <Money amount={c.costPerResult} currency={currency} />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
