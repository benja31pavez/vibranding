import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ChevronRight,
  Globe2,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Send,
  Users,
} from "lucide-react";
import { EmptyState, ErrorState, Panel, StatCard } from "@/components/app";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  campaigns,
  dailySeries,
  formatInt,
  formatPct,
  summarize,
  trafficSources,
  type LandingEventRow,
  type Ranked,
} from "./aggregate";

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/** Filas visibles por lista; el resto va en "Ver todas" (sin cajas con scroll). */
const LIST_LIMIT = 3;

const SERIES = [
  { key: "visitas", label: "Visitas", color: "var(--chart-1)" },
  { key: "clics", label: "Clics (botón y WhatsApp)", color: "var(--chart-2)" },
  { key: "envios", label: "Formularios", color: "var(--chart-3)" },
] as const;

const DATE_FMT = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });
const shortDate = (iso: string) => DATE_FMT.format(new Date(`${iso}T12:00:00`));

export function LandingAnalyticsView({
  rows,
  days,
  onDaysChange,
  loading,
  error,
  onRetry,
}: {
  rows: LandingEventRow[];
  days: AnalyticsRange;
  onDaysChange: (d: AnalyticsRange) => void;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const s = useMemo(() => summarize(rows), [rows]);
  const series = useMemo(() => dailySeries(rows, days), [rows, days]);
  const sources = useMemo(() => trafficSources(rows), [rows]);
  const utm = useMemo(() => campaigns(rows), [rows]);
  const empty = !loading && !error && rows.length === 0;

  return (
    <div className="flex flex-col gap-4 text-foreground md:h-full md:min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-brand-1" aria-hidden="true" />
            Resultados de la landing
          </h2>
          <p className="text-xs text-muted-foreground">
            Visitas reales (sin robots) de los últimos {days} días.
          </p>
        </div>
        <RangeSwitch days={days} onChange={onDaysChange} />
      </div>

      {error ? (
        <ErrorState title="No pudimos cargar la analítica" message={error} onRetry={onRetry} />
      ) : empty ? (
        <EmptyState
          icon={Activity}
          title="Aún no hay visitas en este período"
          description="Comparte el link de la landing en Instagram, WhatsApp o en los anuncios: las visitas, clics y contactos aparecerán aquí."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard
              icon={Users}
              label="Visitas"
              value={formatInt(s.views)}
              loading={loading}
              className="p-3.5"
            />
            <StatCard
              icon={MousePointerClick}
              label="Clics en el botón"
              value={formatInt(s.ctaClicks)}
              loading={loading}
              className="p-3.5"
            />
            <StatCard
              icon={MessageCircle}
              label="Clics a WhatsApp"
              value={formatInt(s.waClicks)}
              loading={loading}
              className="p-3.5"
            />
            <StatCard
              icon={Send}
              label="Formularios"
              value={formatInt(s.submits)}
              loading={loading}
              className="p-3.5"
            />
            <StatCard
              icon={Activity}
              label="Conversión"
              value={formatPct(s.conversion)}
              hint="Contactos / visitas"
              loading={loading}
              className="col-span-2 p-3.5 md:col-span-1"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3 md:min-h-0 md:flex-1">
            <Panel
              title="Evolución diaria"
              icon={Activity}
              className="lg:col-span-2"
              fill
              actions={<ChartLegend />}
            >
              {loading ? (
                <Skeleton className="h-56 w-full md:h-full" />
              ) : (
                <div className="relative h-56 md:h-auto md:min-h-[8rem] md:flex-1">
                  <div className="absolute inset-0">
                    <DailyChart data={series} />
                  </div>
                </div>
              )}
            </Panel>
            <Panel title="Embudo" icon={MousePointerClick} fill>
              <Funnel
                loading={loading}
                steps={[
                  { label: "Visitas", value: s.views },
                  { label: "Clics (botón y WhatsApp)", value: s.ctaClicks + s.waClicks },
                  { label: "Contactos (formulario o WhatsApp)", value: s.contacts },
                ]}
              />
            </Panel>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <RankedPanel
              title="De dónde llegan"
              icon={Globe2}
              items={sources}
              unit="visitas"
              emptyText="Sin visitas registradas."
              loading={loading}
            />
            <RankedPanel
              title="Campañas (UTM)"
              icon={Megaphone}
              items={utm}
              unit="eventos"
              emptyText="Agrega ?utm_source=… al link de tus anuncios para verlos aquí."
              loading={loading}
            />
          </div>
        </>
      )}
    </div>
  );
}

function RangeSwitch({
  days,
  onChange,
}: {
  days: AnalyticsRange;
  onChange: (d: AnalyticsRange) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Período"
      className="inline-flex rounded-app-md border border-border-subtle bg-surface-2 p-0.5"
    >
      {ANALYTICS_RANGES.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={days === d}
          onClick={() => onChange(d)}
          className={cn(
            "rounded-app-sm px-3 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            days === d
              ? "bg-surface text-foreground shadow-app-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {d} días
        </button>
      ))}
    </div>
  );
}

function ChartLegend() {
  return (
    <ul className="hidden flex-wrap items-center gap-3 text-xs text-muted-foreground sm:flex">
      {SERIES.map((s) => (
        <li key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function DailyChart({ data }: { data: ReturnType<typeof dailySeries> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
        <defs>
          {SERIES.map((s) => (
            <linearGradient key={s.key} id={`lp-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          stroke="var(--muted-foreground)"
        />
        <YAxis
          allowDecimals={false}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          stroke="var(--muted-foreground)"
        />
        <Tooltip
          labelFormatter={(v) => shortDate(String(v))}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        {SERIES.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#lp-grad-${s.key})`}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

type FunnelStep = { label: string; value: number; hint?: string };

/** Embudo visitas → clics → contactos con % sobre visitas y paso a paso. */
function Funnel({ steps, loading }: { steps: FunnelStep[]; loading: boolean }) {
  const top = Math.max(steps[0]?.value ?? 0, 1);
  return (
    <ol className="space-y-3" aria-label="Embudo de conversión">
      {steps.map((step, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const share = (step.value / top) * 100;
        const stepRate = prev ? (step.value / prev) * 100 : null;
        return (
          <li key={step.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{step.label}</span>
              {loading ? (
                <Skeleton className="h-5 w-10" />
              ) : (
                <span className="text-base font-semibold tabular-nums">
                  {formatInt(step.value)}
                </span>
              )}
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-gradient-brand transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: loading ? "0%" : `${Math.max(step.value > 0 ? 3 : 0, share)}%` }}
              />
            </div>
            {i > 0 && !loading && (
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                {formatPct(stepRate)} del paso anterior
                {step.hint ? ` · ${step.hint}` : ""}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function RankedPanel({
  title,
  icon,
  items,
  unit,
  emptyText,
  loading,
}: {
  title: string;
  icon: typeof Globe2;
  items: Ranked[];
  unit: string;
  emptyText: string;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const total = items.reduce((acc, it) => acc + it.count, 0);
  const more = items.length > LIST_LIMIT;
  return (
    <Panel
      title={title}
      icon={icon}
      actions={
        more ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-0.5 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver todas ({items.length}) <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null
      }
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <RankedBars items={items.slice(0, LIST_LIMIT)} total={total} unit={unit} />
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {formatInt(total)} {unit} en el período.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <RankedBars items={items} total={total} unit={unit} />
          </div>
        </SheetContent>
      </Sheet>
    </Panel>
  );
}

function RankedBars({ items, total, unit }: { items: Ranked[]; total: number; unit: string }) {
  const max = Math.max(items[0]?.count ?? 1, 1);
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.label} className="text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate">{it.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{formatInt(it.count)}</span>{" "}
              <span className="sr-only">{unit}</span>·{" "}
              {formatPct(total ? (it.count / total) * 100 : null)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${(it.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
