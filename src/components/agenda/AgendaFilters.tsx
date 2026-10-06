import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AGENDA_KINDS, AGENDA_KIND_LABEL_PLURAL, type AgendaKind } from "@/lib/agenda/types";
import { cn } from "@/lib/utils";
import { KIND_STYLE } from "./agendaStyles";

const ALL = "all";

export interface ClientOption {
  id: string;
  name: string;
}

interface AgendaFiltersProps {
  /** Tipos visibles; `null` = todos. */
  kinds: readonly AgendaKind[] | null;
  /** Sin `clients`/`onClientChange` no se muestra el selector (calendario de un solo cliente). */
  clientId?: string | null;
  clients?: readonly ClientOption[];
  counts: Readonly<Record<AgendaKind, number>>;
  onKindsChange: (kinds: AgendaKind[] | null) => void;
  onClientChange?: (clientId: string | null) => void;
  onClear: () => void;
}

export function AgendaFilters({
  kinds,
  clientId = null,
  clients,
  counts,
  onKindsChange,
  onClientChange,
  onClear,
}: AgendaFiltersProps) {
  const active = kinds ?? AGENDA_KINDS;
  const hasFilters = kinds !== null || clientId !== null;

  const handleKinds = (value: string[]) => {
    const next = AGENDA_KINDS.filter((k) => value.includes(k));
    // Sin selección o con todos marcados se vuelve a "todos".
    onKindsChange(next.length === 0 || next.length === AGENDA_KINDS.length ? null : next);
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
      <ToggleGroup
        type="multiple"
        size="sm"
        variant="outline"
        value={[...active]}
        onValueChange={handleKinds}
        aria-label="Filtrar por tipo de evento"
        className="flex-wrap justify-start"
      >
        {AGENDA_KINDS.map((kind) => {
          const { icon: Icon, dot } = KIND_STYLE[kind];
          return (
            <ToggleGroupItem
              key={kind}
              value={kind}
              className={cn(
                "group h-8 gap-1.5 border-border-subtle px-2.5 text-xs shadow-none",
                "data-[state=on]:border-border-strong data-[state=on]:bg-surface data-[state=on]:text-foreground",
                "data-[state=off]:bg-transparent data-[state=off]:text-muted-foreground",
                "hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {/* Activo: punto lleno del color del tipo; inactivo: solo el contorno. */}
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 rounded-full border border-current group-data-[state=on]:border-transparent",
                  "group-data-[state=off]:bg-transparent!",
                  dot,
                )}
              />
              <Icon aria-hidden className="h-3.5 w-3.5" />
              {AGENDA_KIND_LABEL_PLURAL[kind]}
              <span className="tabular-nums text-muted-foreground">
                <span className="sr-only">: </span>
                {counts[kind]}
              </span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        {clients && onClientChange && (
          <Select
            value={clientId ?? ALL}
            onValueChange={(v) => onClientChange(v === ALL ? null : v)}
          >
            <SelectTrigger className="h-9 w-full sm:w-[240px]" aria-label="Filtrar por cliente">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <FilterX aria-hidden className="mr-1.5 h-4 w-4" />
            Quitar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
