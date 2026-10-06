import { Link } from "@tanstack/react-router";
import { Filter } from "lucide-react";
import { EmptyState } from "@/components/app";
import { BlockState } from "./block-state";
import { PIPELINE_STAGES, usePipelineCounts } from "./queries";

/** Mini embudo de prospectos por estado (bloque dentro de "Indicadores"). */
export function PipelineFunnel() {
  const query = usePipelineCounts();

  return (
    <section aria-labelledby="hoy-pipeline" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3
          id="hoy-pipeline"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        >
          <Filter aria-hidden className="h-3.5 w-3.5" /> Pipeline de prospectos
        </h3>
        <Link
          to="/pipeline"
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Abrir
        </Link>
      </div>
      <BlockState query={query} loadingLabel="Cargando pipeline">
        {(counts) => {
          const max = Math.max(0, ...PIPELINE_STAGES.map((s) => counts[s.key] ?? 0));
          if (max === 0) {
            return (
              <EmptyState
                size="compact"
                className="py-2"
                icon={Filter}
                title="Sin prospectos todavía."
              />
            );
          }
          return (
            <ol className="space-y-1">
              {PIPELINE_STAGES.map((s) => {
                const n = counts[s.key] ?? 0;
                const width = n === 0 ? 0 : Math.max(4, Math.round((n / max) * 100));
                return (
                  <li
                    key={s.key}
                    className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2 text-xs"
                  >
                    <span className="truncate text-muted-foreground">{s.label}</span>
                    <span className="h-3 overflow-hidden rounded-app-sm bg-surface-2">
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
    </section>
  );
}
