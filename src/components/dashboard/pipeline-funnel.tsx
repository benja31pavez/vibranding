import { Filter } from "lucide-react";
import { EmptyState, Panel } from "@/components/app";
import { BlockState } from "./block-state";
import { PIPELINE_STAGES, usePipelineCounts } from "./queries";

/** Mini embudo de prospectos por estado. */
export function PipelineFunnel() {
  const query = usePipelineCounts();

  return (
    <Panel className="min-w-0" icon={Filter} title="Pipeline" description="Prospectos por etapa">
      <BlockState query={query} loadingLabel="Cargando pipeline">
        {(counts) => {
          const max = Math.max(0, ...PIPELINE_STAGES.map((s) => counts[s.key] ?? 0));
          if (max === 0) {
            return (
              <EmptyState
                size="compact"
                className="py-3"
                icon={Filter}
                title="Sin prospectos todavía."
                description="Cuando agregues prospectos verás aquí el embudo."
              />
            );
          }
          return (
            <ol className="space-y-1.5">
              {PIPELINE_STAGES.map((s) => {
                const n = counts[s.key] ?? 0;
                const width = n === 0 ? 0 : Math.max(4, Math.round((n / max) * 100));
                return (
                  <li
                    key={s.key}
                    className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm"
                  >
                    <span className="truncate text-muted-foreground">{s.label}</span>
                    <span className="h-5 overflow-hidden rounded-app-sm bg-surface-2">
                      <span
                        className={
                          s.key === "ganado"
                            ? "block h-full bg-success"
                            : "block h-full bg-primary/70"
                        }
                        style={{ width: `${width}%` }}
                      />
                    </span>
                    <span className="text-right font-medium tabular-nums">{n}</span>
                  </li>
                );
              })}
            </ol>
          );
        }}
      </BlockState>
    </Panel>
  );
}
