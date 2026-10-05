import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app";
import { periodLabel } from "@/lib/billing/dates";
import type { KeyFigure, PortalReport, SectionResult } from "@/lib/portal/model";
import { cn } from "@/lib/utils";
import { PortalSection, SectionState } from "./PortalSection";

interface ResultsSectionProps {
  loading: boolean;
  result: SectionResult<PortalReport | null> | undefined;
  onRetry: () => void;
  retrying: boolean;
}

/** Último reporte mensual enviado: 3 cifras clave y enlace al reporte completo. */
export function ResultsSection({ loading, result, onRetry, retrying }: ResultsSectionProps) {
  return (
    <PortalSection id="resultados" title="Tus resultados" icon={BarChart3}>
      <SectionState
        loading={loading}
        result={result}
        onRetry={onRetry}
        retrying={retrying}
        skeletonRows={3}
      >
        {(report) =>
          !report ? (
            <EmptyState
              size="compact"
              icon={BarChart3}
              title="Tu primer reporte viene en camino"
              description="A comienzos de cada mes te enviamos un resumen de cómo le fue a tu marca. Aparecerá aquí."
            />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Resumen de{" "}
                <span className="font-medium text-foreground">{periodLabel(report.period)}</span>
              </p>
              {report.figures.length > 0 ? (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {report.figures.map((figure, i) => (
                    <FigureCard
                      key={figure.label}
                      figure={figure}
                      wide={i === 0 && report.figures.length % 2 === 1}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Este reporte no trae cifras destacadas.
                </p>
              )}
              {report.summary && (
                <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                  {report.summary}
                </p>
              )}
              <Button asChild variant="outline" className="h-11 w-full sm:w-auto">
                <a href={`/r/${encodeURIComponent(report.token)}`} target="_blank" rel="noreferrer">
                  Ver reporte completo <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
                </a>
              </Button>
            </div>
          )
        }
      </SectionState>
    </PortalSection>
  );
}

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;
const TREND_CLASS = {
  up: "text-success-strong",
  down: "text-danger-strong",
  flat: "text-muted-foreground",
} as const;

function FigureCard({ figure, wide }: { figure: KeyFigure; wide: boolean }) {
  const Icon = figure.trend ? TREND_ICON[figure.trend] : null;
  return (
    <li
      className={cn(
        "flex flex-col rounded-app-lg border border-border-subtle bg-bg p-3.5 shadow-app-xs sm:p-4",
        wide && "col-span-2 sm:col-span-1",
      )}
    >
      <p className="text-xs font-medium leading-snug text-muted-foreground">{figure.label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
        {figure.value}
      </p>
      {figure.detail && (
        <p
          className={cn(
            "mt-auto flex items-start gap-1 pt-1.5 text-xs leading-snug",
            figure.trend ? TREND_CLASS[figure.trend] : "text-muted-foreground",
          )}
        >
          {Icon && <Icon aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />}
          {figure.detail}
        </p>
      )}
    </li>
  );
}
