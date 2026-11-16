import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BrandTile } from "@/components/multilink/editor/BrandTile";
import { itemLinkKind } from "@/lib/site/multilinkDraft";
import { formatCount, formatPct, type ItemClicks } from "@/components/multilink/analyticsModel";

/** En la tarjeta caben los primeros; el resto va en el panel lateral "Ver todos". */
const VISIBLE = 5;

function LinkBar({
  row,
  views,
  max,
  rank,
}: {
  row: ItemClicks;
  views: number;
  max: number;
  rank: number;
}) {
  const { item, clicks } = row;
  const ctr = views > 0 ? (clicks / views) * 100 : null;
  return (
    <li className="flex items-center gap-3">
      <span className="w-4 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
        {rank}
      </span>
      <BrandTile kind={itemLinkKind(item)} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="truncate font-medium">{item.title || "Sin título"}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            <span className="font-semibold text-foreground">{formatCount(clicks)}</span> ·{" "}
            {formatPct(ctr)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full ${rank === 1 && clicks > 0 ? "bg-gradient-brand" : "bg-brand-1/60"}`}
            style={{ width: `${clicks > 0 ? Math.max((clicks / max) * 100, 3) : 0}%` }}
          />
        </div>
      </div>
    </li>
  );
}

export function TopLinks({ perItem, views }: { perItem: ItemClicks[]; views: number }) {
  const max = Math.max(1, ...perItem.map((p) => p.clicks));
  const list = (rows: ItemClicks[]) => (
    <ol className="space-y-3">
      {rows.map((row, k) => (
        <LinkBar key={row.item.id} row={row} views={views} max={max} rank={k + 1} />
      ))}
    </ol>
  );
  return (
    <div className="flex flex-col rounded-app-lg border border-border-subtle bg-surface p-4 shadow-app-xs">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Enlaces más tocados</h3>
        <p className="text-xs text-muted-foreground">Clics · % de las visitas que lo tocaron</p>
      </div>
      {perItem.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay enlaces.</p>
      ) : (
        list(perItem.slice(0, VISIBLE))
      )}
      {perItem.length > VISIBLE && (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="mt-3 self-start">
              Ver todos ({perItem.length}){" "}
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Todos los enlaces</SheetTitle>
              <SheetDescription>Ordenados por clics en el período elegido.</SheetDescription>
            </SheetHeader>
            <div className="mt-4">{list(perItem)}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
