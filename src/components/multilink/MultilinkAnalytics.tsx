import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Eye, MessageCircle, MousePointerClick } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withoutBots } from "@/lib/analytics/bots";
import { EmptyState, ErrorState } from "@/components/app";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MultilinkItem } from "@/lib/multilink";
import {
  clicksPerItem,
  dailySeries,
  formatCount,
  formatPct,
  isClick,
  visitSources,
  type DayPoint,
  type EventRow,
} from "@/components/multilink/analyticsModel";
import { TopLinks } from "@/components/multilink/AnalyticsTopLinks";
import { Sparkline } from "@/components/multilink/Sparkline";

const RANGES = [7, 30, 90] as const;
const DAY_MS = 86_400_000;

/**
 * Per-link analytics computed from landing_events: clicks over time,
 * click-through rate per item and traffic source.
 */
export function MultilinkAnalytics({
  clientId,
  multilinkId,
  items,
}: {
  clientId: string;
  multilinkId: string;
  items: MultilinkItem[];
}) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const from = new Date(Date.now() - (days - 1) * DAY_MS);
    from.setHours(0, 0, 0, 0);
    supabase
      .from("landing_events")
      .select(
        "event_name,item_id,referrer,utm_source,utm_medium,utm_campaign,created_at,user_agent",
      )
      .eq("client_id", clientId)
      .eq("source_type", "multilink")
      .eq("source_id", multilinkId)
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        setRows(withoutBots((data ?? []) as EventRow[]));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, multilinkId, days, attempt]);

  return (
    <MultilinkAnalyticsView
      rows={rows}
      items={items}
      days={days}
      onDaysChange={setDays}
      loading={loading}
      error={error}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

export function MultilinkAnalyticsView({
  rows,
  items,
  days,
  onDaysChange,
  loading,
  error = null,
  onRetry,
}: {
  rows: EventRow[];
  items: MultilinkItem[];
  days: number;
  onDaysChange: (d: number) => void;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const series = useMemo(() => dailySeries(rows, days), [rows, days]);
  const perItem = useMemo(() => clicksPerItem(rows, items), [rows, items]);
  const sources = useMemo(() => visitSources(rows), [rows]);
  const views = rows.filter((r) => r.event_name === "page_view").length;
  const clicks = rows.filter(isClick).length;
  const waClicks = rows.filter((r) => r.event_name === "whatsapp_click").length;
  const ctr = views > 0 ? (clicks / views) * 100 : null;

  return (
    <section aria-labelledby="ml-analytics-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ml-analytics-title" className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-brand-1" aria-hidden="true" /> Analítica del multienlace
        </h2>
        <RangePicker days={days} onChange={onDaysChange} />
      </div>

      {error ? (
        <ErrorState title="No pudimos cargar las métricas" message={error} onRetry={onRetry} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Eye} label="Visitas" value={formatCount(views)} loading={loading}>
              <Sparkline values={series.map((d) => d.visitas)} tone="var(--chart-1)" />
            </Kpi>
            <Kpi
              icon={MousePointerClick}
              label="Clics en enlaces"
              value={formatCount(clicks)}
              loading={loading}
            >
              <Sparkline values={series.map((d) => d.clics)} tone="var(--brand-2)" />
            </Kpi>
            <Kpi
              icon={MessageCircle}
              label="Clics a WhatsApp"
              value={formatCount(waClicks)}
              loading={loading}
            >
              <Sparkline values={series.map((d) => d.whatsapp)} tone="#16a34a" />
            </Kpi>
            <Kpi
              icon={Activity}
              label="Visitas que hacen clic"
              value={formatPct(ctr)}
              loading={loading}
              hint={ctr === null ? "Sin visitas aún" : "de cada 100 visitas"}
            />
          </div>

          {loading ? (
            <div className="grid gap-3 lg:grid-cols-3">
              <Skeleton className="h-64 rounded-app-lg lg:col-span-2" />
              <Skeleton className="h-64 rounded-app-lg" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-app-lg border border-border-subtle bg-surface p-6 shadow-app-xs">
              <EmptyState
                size="compact"
                icon={Activity}
                title="Sin visitas en este período"
                description="Comparte el link o el QR en la bio y aquí verás visitas, clics y de dónde llegan."
              />
            </div>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-3">
                <TrendCard series={series} />
                <TopLinks perItem={perItem} views={views} />
              </div>
              <SourcesCard sources={sources} total={views} />
            </>
          )}
        </>
      )}
    </section>
  );
}

function RangePicker({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <div role="group" aria-label="Período" className="flex gap-1 rounded-app-md bg-muted p-1">
      {RANGES.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={days === d}
          onClick={() => onChange(d)}
          className={cn(
            "rounded-app-sm px-3 py-1 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            days === d
              ? "bg-background text-foreground shadow-app-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {d} días
        </button>
      ))}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  loading,
  hint,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  loading: boolean;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="card-brand flex flex-col justify-between gap-2 rounded-app-lg border border-border-subtle bg-surface p-4 shadow-app-xs"
      aria-busy={loading || undefined}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-brand-1" aria-hidden="true" />
        {label}
      </div>
      <div className="flex items-end justify-between gap-3">
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <span className="text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
            {value}
          </span>
        )}
        {!loading && children}
      </div>
      {hint && !loading && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const shortDate = (v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`;

function TrendCard({ series }: { series: DayPoint[] }) {
  return (
    <div className="flex flex-col rounded-app-lg border border-border-subtle bg-surface p-4 shadow-app-xs lg:col-span-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Visitas y clics por día</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Legend color="var(--chart-1)" label="Visitas" />
          <Legend color="var(--brand-2)" label="Clics" />
        </div>
      </div>
      <div
        className="h-52 lg:h-auto lg:min-h-52 lg:flex-1"
        role="img"
        aria-label="Gráfico de visitas y clics por día"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ left: -18, right: 6, top: 6, bottom: 0 }}>
            <defs>
              <linearGradient id="ml-views" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ml-clicks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-2)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--brand-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              stroke="var(--muted-foreground)"
            />
            <YAxis
              allowDecimals={false}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              stroke="var(--muted-foreground)"
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
              labelFormatter={(v) =>
                new Date(`${v}T12:00:00`).toLocaleDateString("es-CL", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })
              }
            />
            <Area
              type="monotone"
              name="Visitas"
              dataKey="visitas"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#ml-views)"
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Area
              type="monotone"
              name="Clics"
              dataKey="clics"
              stroke="var(--brand-2)"
              strokeWidth={2}
              fill="url(#ml-clicks)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

function SourcesCard({ sources, total }: { sources: [string, number][]; total: number }) {
  return (
    <div className="rounded-app-lg border border-border-subtle bg-surface p-4 shadow-app-xs">
      <h3 className="mb-3 text-sm font-semibold">De dónde llegan las visitas</h3>
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin visitas registradas.</p>
      ) : (
        <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {sources.slice(0, 6).map(([label, n]) => {
            const pct = total > 0 ? (n / total) * 100 : 0;
            return (
              <li key={label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    <span className="font-medium text-foreground">{formatCount(n)}</span> ·{" "}
                    {formatPct(pct)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-gradient-brand"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
