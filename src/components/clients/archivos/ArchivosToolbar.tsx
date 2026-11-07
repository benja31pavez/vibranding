import { Search } from "lucide-react";
import { FilterChips } from "@/components/app";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { KIND_LABEL, monthOptionLabel, type FileFilters, type FileKind } from "./archivosModel";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Control segmentado (misma línea que "Trabajo del mes"). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 gap-1 rounded-app-md bg-surface-2 p-1 ring-1 ring-inset ring-border-subtle",
        className,
      )}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-app-sm px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors",
              selected
                ? "bg-surface text-foreground shadow-app-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center tabular-nums",
                  selected ? "bg-brand-soft text-brand-1" : "bg-surface",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type View = "gallery" | "documents";

export function Toolbar({
  view,
  onView,
  counts,
  kinds,
  months,
  filters,
  onFilters,
}: {
  view: View;
  onView: (v: View) => void;
  counts: Record<View, number>;
  /** Tipos presentes en la galería con su cantidad, en orden. */
  kinds: readonly { kind: FileKind; count: number }[];
  months: string[];
  filters: FileFilters;
  onFilters: (f: FileFilters) => void;
}) {
  const kindOptions = [
    { value: "all" as const, label: "Todo", count: counts.gallery },
    ...kinds.map((k) => ({ value: k.kind, label: KIND_LABEL[k.kind], count: k.count })),
  ];
  return (
    <div className="flex shrink-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Vista"
          value={view}
          onChange={onView}
          options={[
            { value: "gallery", label: "Galería", count: counts.gallery },
            { value: "documents", label: "Documentos", count: counts.documents },
          ]}
        />
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          {months.length > 1 && (
            <Select
              value={filters.month}
              onValueChange={(month) => onFilters({ ...filters, month })}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Mes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthOptionLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={filters.query}
              onChange={(e) => onFilters({ ...filters, query: e.target.value })}
              placeholder="Buscar por nombre"
              aria-label="Buscar archivos por nombre"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>
      {view === "gallery" && kinds.length > 1 && (
        <FilterChips
          label="Tipo de pieza"
          value={filters.kind}
          options={kindOptions}
          onChange={(kind) => onFilters({ ...filters, kind })}
          className="max-sm:-mx-3 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-3 max-sm:pb-1"
        />
      )}
    </div>
  );
}
