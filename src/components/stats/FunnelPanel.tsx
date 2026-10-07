import { Filter } from "lucide-react";
import { Panel } from "@/components/app";
import type { FunnelStage } from "@/lib/analytics/aggregate";
import { formatCount, formatRate } from "./format";

/** Embudo horizontal: cada barra es proporcional a las visitas únicas. */
export function FunnelPanel({ stages }: { stages: readonly FunnelStage[] }) {
  const top = Math.max(1, stages[0]?.value ?? 0);
  return (
    <Panel title="Embudo" icon={Filter} description="Respecto de las visitas únicas">
      <ol className="space-y-2.5">
        {stages.map((s) => (
          <li key={s.key}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="tabular-nums">
                <span className="font-semibold text-foreground">{formatCount(s.value)}</span>
                {s.key !== "visits" && (
                  <span className="ml-1.5 text-muted-foreground">
                    {formatRate(s.rateFromVisits)}
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-primary bg-gradient-brand"
                style={{ width: `${Math.min(100, (s.value / top) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
