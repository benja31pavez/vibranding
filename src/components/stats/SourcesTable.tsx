import { useState } from "react";
import { ChevronLeft, ChevronRight, Compass } from "lucide-react";
import { Panel } from "@/components/app";
import { Button } from "@/components/ui/button";
import { paginate, type SourceRow } from "@/lib/analytics/aggregate";
import { formatCount, formatRate } from "./format";

const PAGE_SIZE = 6;

/** Fuentes de primer contacto con su conversión a diagnóstico, paginadas. */
export function SourcesTable({ rows }: { rows: readonly SourceRow[] }) {
  const [page, setPage] = useState(0);
  const view = paginate(rows, page, PAGE_SIZE);
  const pager =
    view.pages > 1 ? (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Fuentes anteriores"
          disabled={view.page === 0}
          onClick={() => setPage(view.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="tabular-nums">
          {view.page + 1}/{view.pages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Fuentes siguientes"
          disabled={view.page >= view.pages - 1}
          onClick={() => setPage(view.page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    ) : null;

  return (
    <Panel
      title="Fuentes"
      icon={Compass}
      description="Primer contacto de cada visita (UTM, anuncio u origen)"
      actions={pager}
      bodyClassName="px-0 pb-2"
    >
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Sin visitas en este período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="border-b border-border-subtle text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-1.5 font-medium">
                  Fuente
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Visitas
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Clics CTA
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Diagnósticos
                </th>
                <th scope="col" className="px-5 py-1.5 text-right font-medium">
                  Conv.
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {view.items.map((r) => (
                <tr key={r.source} className="border-b border-border-subtle last:border-0">
                  <td className="max-w-[220px] truncate px-5 py-1.5" title={r.source}>
                    {r.source}
                  </td>
                  <td className="px-3 py-1.5 text-right">{formatCount(r.visits)}</td>
                  <td className="px-3 py-1.5 text-right">{formatCount(r.ctaVisitors)}</td>
                  <td className="px-3 py-1.5 text-right">{formatCount(r.submits)}</td>
                  <td className="px-5 py-1.5 text-right text-muted-foreground">
                    {formatRate(r.conversion)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
