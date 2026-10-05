import { TrendingUp } from "lucide-react";
import { Panel } from "@/components/app";
import type { SiteStats } from "@/lib/analytics/aggregate";
import { formatCount } from "./format";

const CHART_HEIGHT = 64;
const DAY_LABEL = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "YYYY-MM-DD" (ya en hora de Santiago) → "5 oct". */
function dayLabel(key: string): string {
  return DAY_LABEL.format(new Date(`${key}T12:00:00Z`));
}

const DEVICE_LABELS = { mobile: "Móvil", desktop: "Escritorio", tablet: "Tablet" } as const;

function devicesLine(devices: SiteStats["devices"]): string {
  const total = devices.mobile + devices.desktop + devices.tablet;
  if (total === 0) return "";
  return (Object.keys(DEVICE_LABELS) as Array<keyof typeof DEVICE_LABELS>)
    .map((k) => `${DEVICE_LABELS[k]} ${Math.round((devices[k] / total) * 100)} %`)
    .join(" · ");
}

/** Barras diarias de visitas únicas (días de Santiago) con dispositivos y tipos de CTA. */
export function TrendChart({ stats }: { stats: SiteStats }) {
  const max = Math.max(1, ...stats.trend.map((d) => d.visits));
  const width = stats.trend.length * 10;
  const first = stats.trend[0];
  const last = stats.trend.at(-1);
  const total = stats.trend.reduce((sum, d) => sum + d.visits, 0);
  const cta = stats.ctaBreakdown;
  return (
    <Panel
      title="Visitas únicas por día"
      icon={TrendingUp}
      description={devicesLine(stats.devices) || "Sin visitas en este período"}
      actions={
        <span className="text-xs text-muted-foreground tabular-nums">
          CTA: WhatsApp {formatCount(cta.whatsapp)} · Diagnóstico {formatCount(cta.diagnostico)} ·
          Planes {formatCount(cta.plan)}
        </span>
      }
    >
      <svg
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-16 w-full"
        role="img"
        aria-label={`${formatCount(total)} visitas únicas entre ${first ? dayLabel(first.day) : ""} y ${last ? dayLabel(last.day) : ""}; máximo diario ${formatCount(max)}`}
      >
        {stats.trend.map((d, i) => {
          const h = (d.visits / max) * (CHART_HEIGHT - 2);
          return (
            <rect
              key={d.day}
              x={i * 10 + 1}
              y={CHART_HEIGHT - Math.max(h, d.visits ? 1.5 : 0.5)}
              width={8}
              height={Math.max(h, d.visits ? 1.5 : 0.5)}
              className={d.visits ? "fill-primary" : "fill-muted"}
            >
              <title>{`${dayLabel(d.day)}: ${formatCount(d.visits)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{first ? dayLabel(first.day) : ""}</span>
        <span>máx. {formatCount(max)}/día</span>
        <span>{last ? dayLabel(last.day) : ""}</span>
      </div>
    </Panel>
  );
}
