import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Activity, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, ListSkeleton, Panel, StatusBadge } from "@/components/app";
import type { StatusTone } from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  ENGAGEMENT_CACHE_HOURS,
  ENGAGEMENT_SAMPLE_SIZE,
  MIN_POST_AGE_HOURS,
  benchmarkLevel,
  benchmarkTier,
  type EngagementLevel,
  type EngagementSnapshot,
} from "@/lib/instagram/engagement";
import { getIgEngagement, refreshIgEngagement } from "@/lib/instagram/engagement.functions";

export const LEVEL_META: Readonly<Record<EngagementLevel, { label: string; tone: StatusTone }>> = {
  alto: { label: "Alto", tone: "success" },
  medio: { label: "Medio", tone: "warning" },
  bajo: { label: "Bajo", tone: "danger" },
};

const SOURCE_LABEL = {
  own: "Cuenta conectada",
  discovery: "Perfil público (Business Discovery)",
} as const;

const nf = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });
const rateFmt = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const engagementKey = (clientId: string) => ["ig-engagement", clientId] as const;

export function measuredAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "fecha desconocida";
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

export function formatRate(rate: number): string {
  return `${rateFmt.format(rate)} %`;
}

/** Shared query: the Instagram section and the ficha header chip reuse it. */
export function useIgEngagement(clientId: string) {
  const fetchView = useServerFn(getIgEngagement);
  return useQuery({
    queryKey: engagementKey(clientId),
    queryFn: () => fetchView({ data: { clientId } }),
    staleTime: 5 * 60 * 1000,
  });
}

/** Engagement del perfil de Instagram del cliente (sección Instagram). */
export function EngagementCard({ clientId }: { clientId: string }) {
  const view = useIgEngagement(clientId);
  const refresh = useServerFn(refreshIgEngagement);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await refresh({ data: { clientId } });
      if (res.status === "missing_table") {
        toast.error("Falta aplicar la migración de engagement en la base de datos.");
      } else if (res.status === "cached") {
        toast.info(
          `Ya hay una medición reciente (${measuredAgo(res.snapshot.measured_at)}). Se puede volver a medir cada ${ENGAGEMENT_CACHE_HOURS} h.`,
        );
      } else if (res.snapshot.error) {
        toast.error(res.snapshot.error);
      } else {
        toast.success("Engagement actualizado");
      }
      await queryClient.invalidateQueries({ queryKey: engagementKey(clientId) });
    } catch (e) {
      console.error("[ig-engagement] refresh failed", e);
      toast.error(e instanceof Error ? e.message : "No se pudo medir el engagement");
    } finally {
      setRefreshing(false);
    }
  };

  if (view.isPending) {
    return (
      <Panel icon={Activity} title="Engagement">
        <ListSkeleton rows={2} />
      </Panel>
    );
  }
  if (view.isError) {
    return (
      <ErrorState
        title="No pudimos cargar el engagement"
        message={view.error instanceof Error ? view.error.message : undefined}
        onRetry={() => void view.refetch()}
        retrying={view.isFetching}
      />
    );
  }

  const { available, canEdit, snapshot } = view.data;
  const actions = canEdit && available && (
    <Button size="sm" variant="outline" disabled={refreshing} onClick={() => void onRefresh()}>
      <RefreshCw aria-hidden className={`mr-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      {refreshing ? "Midiendo…" : "Actualizar"}
    </Button>
  );

  return (
    <Panel
      icon={Activity}
      title="Engagement"
      description={`Promedio de likes + comentarios de las últimas ${ENGAGEMENT_SAMPLE_SIZE} publicaciones (con más de ${MIN_POST_AGE_HOURS} h) ÷ seguidores.`}
      actions={actions || undefined}
    >
      {!available ? (
        <EmptyState
          size="compact"
          title="Engagement aún no disponible"
          description="Falta aplicar la migración de la tabla de mediciones."
        />
      ) : !snapshot ? (
        <EmptyState
          size="compact"
          title="Sin mediciones todavía"
          description={
            canEdit
              ? "Presiona “Actualizar” para medirlo con la API oficial de Instagram."
              : "Un editor de la agencia debe medirlo."
          }
        />
      ) : snapshot.error || snapshot.engagement_rate === null ? (
        <EmptyState
          size="compact"
          title="No se pudo medir"
          description={`${snapshot.error ?? "Medición incompleta."} · ${measuredAgo(snapshot.measured_at)}`}
        />
      ) : (
        <EngagementBody snapshot={snapshot} rate={snapshot.engagement_rate} />
      )}
    </Panel>
  );
}

function EngagementBody({ snapshot, rate }: { snapshot: EngagementSnapshot; rate: number }) {
  const followers = snapshot.followers ?? 0;
  const level = LEVEL_META[benchmarkLevel(rate, followers)];
  const tier = benchmarkTier(followers);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <span className="text-4xl font-semibold tabular-nums tracking-tight">
          {formatRate(rate)}
        </span>
        <StatusBadge status={`engagement_${level.label}`} label={level.label} tone={level.tone} />
        <span className="text-xs text-muted-foreground">
          Referencia {tier.label.toLowerCase()}: alto ≥ {tier.high} %, medio ≥ {tier.medium} %
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Seguidores" value={nf.format(followers)} />
        <Stat label="Likes promedio" value={fmtOrDash(snapshot.avg_likes)} />
        <Stat label="Comentarios promedio" value={fmtOrDash(snapshot.avg_comments)} />
        <Stat label="Posts por semana" value={fmtOrDash(snapshot.posts_per_week)} />
      </dl>
      <p className="text-xs text-muted-foreground">
        Muestra: {snapshot.posts_sampled ?? 0} publicaciones
        {snapshot.username ? ` de @${snapshot.username}` : ""} · {SOURCE_LABEL[snapshot.source]} ·
        medido {measuredAgo(snapshot.measured_at)}
      </p>
    </div>
  );
}

function fmtOrDash(v: number | null): string {
  return v === null ? "—" : nf.format(v);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/** Chip compacto para el header de la ficha. No muestra nada si no hay medición válida. */
export function EngagementChip({ clientId }: { clientId: string }) {
  const view = useIgEngagement(clientId);
  const snap = view.data?.snapshot;
  if (!snap || snap.error || snap.engagement_rate === null) return null;
  const level = LEVEL_META[benchmarkLevel(snap.engagement_rate, snap.followers ?? 0)];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
      title={`Engagement de Instagram (${snap.posts_sampled ?? 0} posts), medido ${measuredAgo(snap.measured_at)}`}
    >
      <Activity aria-hidden className="h-3.5 w-3.5" />
      <span className="font-medium tabular-nums text-foreground">
        {formatRate(snap.engagement_rate)}
      </span>
      <StatusBadge status={`engagement_${level.label}`} label={level.label} tone={level.tone} />
    </span>
  );
}
