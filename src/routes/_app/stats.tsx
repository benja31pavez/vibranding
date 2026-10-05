import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, MousePointerClick, Target, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ErrorState, PageContainer, PageHeader, StatCard } from "@/components/app";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FunnelPanel } from "@/components/stats/FunnelPanel";
import { SourcesTable } from "@/components/stats/SourcesTable";
import { TrendChart } from "@/components/stats/TrendChart";
import { formatCount, formatRate } from "@/components/stats/format";
import { aggregateSiteStats } from "@/lib/analytics/aggregate";
import { loadDiagnosticoProspects, loadFirstEventAt, loadSiteEvents } from "@/lib/analytics/load";
import { STATS_TIME_ZONE } from "@/lib/analytics/time";
import { isCountingDisabled, setCountingDisabled } from "@/lib/track";

export const Route = createFileRoute("/_app/stats")({
  component: StatsPage,
  head: () => ({
    meta: [
      { title: "Estadísticas del landing · Vibranding" },
      {
        name: "description",
        content: "Visitas únicas, clics, diagnósticos y prospectos del sitio, sin bots ni equipo.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const RANGES = [7, 30, 90] as const;
type RangeDays = (typeof RANGES)[number];
const DATE = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: STATS_TIME_ZONE });

function useSiteStats(days: RangeDays) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const data = useQuery({
    queryKey: ["landing-stats", userId, days],
    enabled: Boolean(userId),
    queryFn: async () => {
      const now = new Date();
      const [events, prospectDates] = await Promise.all([
        loadSiteEvents(days, now),
        loadDiagnosticoProspects(days, now),
      ]);
      return { events, prospectDates, now };
    },
  });
  const since = useQuery({
    queryKey: ["landing-stats", userId, "since"],
    enabled: Boolean(userId),
    queryFn: loadFirstEventAt,
  });
  const stats = useMemo(
    () =>
      data.data
        ? aggregateSiteStats(data.data.events.rows, {
            days,
            now: data.data.now,
            prospectDates: data.data.prospectDates,
          })
        : null,
    [data.data, days],
  );
  return { data, since, stats, truncated: data.data?.events.truncated ?? false };
}

/** "No contarme": se lee después de montar para no desalinear el SSR. */
function NoCountToggle() {
  const [disabled, setDisabled] = useState(false);
  useEffect(() => setDisabled(isCountingDisabled()), []);
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="no-contarme"
        checked={disabled}
        onCheckedChange={(v) => {
          setCountingDisabled(v);
          setDisabled(v);
        }}
      />
      <Label htmlFor="no-contarme" className="text-xs text-muted-foreground">
        No contar este navegador
      </Label>
    </div>
  );
}

function StatsPage() {
  const [days, setDays] = useState<RangeDays>(30);
  const { data, since, stats, truncated } = useSiteStats(days);
  const loading = data.isPending;
  const stage = (key: string) => stats?.funnel.find((s) => s.key === key);

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title="Estadísticas del landing"
        description="Personas reales: sin bots, sin recargas repetidas y sin el equipo con sesión iniciada."
        actions={
          <>
            <NoCountToggle />
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={String(days)}
              onValueChange={(v) => v && setDays(Number(v) as RangeDays)}
              aria-label="Período"
            >
              {RANGES.map((r) => (
                <ToggleGroupItem key={r} value={String(r)} className="px-3 text-xs">
                  {r} días
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </>
        }
      />

      {data.isError ? (
        <ErrorState
          message={data.error instanceof Error ? data.error.message : undefined}
          onRetry={() => void data.refetch()}
          retrying={data.isFetching}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Visitas únicas"
              loading={loading}
              value={formatCount(stage("visits")?.value ?? 0)}
              hint={stats ? `${formatCount(stats.sample.sessions)} sesiones` : undefined}
            />
            <StatCard
              icon={MousePointerClick}
              label="Tasa de clic a CTA"
              loading={loading}
              value={formatRate(stage("cta")?.rateFromVisits ?? null)}
              hint={`${formatCount(stage("cta")?.value ?? 0)} visitantes`}
            />
            <StatCard
              icon={ClipboardCheck}
              label="Diagnósticos enviados"
              loading={loading}
              value={formatCount(stage("submits")?.value ?? 0)}
              hint={formatRate(stage("submits")?.rateFromVisits ?? null)}
            />
            <StatCard
              icon={Target}
              label="Conversión a prospecto"
              loading={loading}
              value={formatRate(stage("prospects")?.rateFromVisits ?? null)}
              hint={`${formatCount(stage("prospects")?.value ?? 0)} prospectos`}
            />
          </div>

          {stats && (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <FunnelPanel stages={stats.funnel} />
                <div className="lg:col-span-2">
                  <SourcesTable key={days} rows={stats.sources} />
                </div>
              </div>
              <TrendChart stats={stats} />
              <p className="text-xs text-muted-foreground">
                Muestra: {formatCount(stats.sample.events)} eventos válidos ·{" "}
                {formatCount(stats.sample.botsExcluded)} de bots excluidos
                {stats.sample.legacyEvents > 0 &&
                  ` · ${formatCount(stats.sample.legacyEvents)} antiguos sin sesión (cada uno cuenta 1)`}
                {" · "}Datos desde {since.data ? DATE.format(new Date(since.data)) : "—"} · Días en
                hora de Santiago
                {truncated && " · Período con demasiados eventos: se muestran los primeros 30.000"}
              </p>
            </>
          )}
        </>
      )}
    </PageContainer>
  );
}
