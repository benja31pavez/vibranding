import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { EmptyState } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROSPECT_STATES, STATE_META } from "@/lib/prospects/schema";
import { cn } from "@/lib/utils";
import {
  ConvertAction,
  CreateProposalAction,
  MarketingBadge,
  NoContactBadge,
  ResumeAction,
  StageSelect,
  type CardActions,
} from "./ProspectCard";
import { formatShortDate } from "./format";
import type { Prospect } from "./prospectsData";

const ALL = "";
type SortDir = "asc" | "desc";

interface Filters {
  estado: string;
  rubro: string;
  comuna: string;
  fuente: string;
  q: string;
}

const EMPTY_FILTERS: Filters = { estado: ALL, rubro: ALL, comuna: ALL, fuente: ALL, q: "" };

function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function distinct(list: Prospect[], field: "rubro" | "comuna" | "fuente"): string[] {
  const values = new Set(list.map((p) => p[field]?.trim()).filter((v): v is string => Boolean(v)));
  return [...values].sort((a, b) => a.localeCompare(b, "es"));
}

const STATE_OPTIONS = PROSPECT_STATES.map((s) => ({ value: s, label: STATE_META[s].label }));

/** Filtra por estado/rubro/comuna/fuente exactos y búsqueda libre (nombre, correo, teléfono, instagram, notas). */
export function filterProspects(list: Prospect[], f: Filters): Prospect[] {
  const q = normalize(f.q.trim());
  return list.filter((p) => {
    if (f.estado && p.estado !== f.estado) return false;
    if (f.rubro && p.rubro?.trim() !== f.rubro) return false;
    if (f.comuna && p.comuna?.trim() !== f.comuna) return false;
    if (f.fuente && p.fuente.trim() !== f.fuente) return false;
    if (!q) return true;
    return [p.nombre, p.email_publico, p.telefono_publico, p.instagram, p.web, p.notas].some((v) =>
      normalize(v).includes(q),
    );
  });
}

/** Orden por último contacto; los que nunca se contactaron van al final. */
export function sortByLastContact(list: Prospect[], dir: SortDir): Prospect[] {
  const time = (p: Prospect) => (p.ultimo_contacto ? new Date(p.ultimo_contacto).getTime() : null);
  return [...list].sort((a, b) => {
    const ta = time(a);
    const tb = time(b);
    if (ta === tb) return a.nombre.localeCompare(b.nombre, "es");
    if (ta === null) return 1;
    if (tb === null) return -1;
    return dir === "asc" ? ta - tb : tb - ta;
  });
}

type Option = string | { value: string; label: string };

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-app-sm border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value={ALL}>Todos</option>
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export function ProspectsTable({
  prospects,
  actions,
}: {
  prospects: Prospect[];
  actions: CardActions;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const options = useMemo(
    () => ({
      rubro: distinct(prospects, "rubro"),
      comuna: distinct(prospects, "comuna"),
      fuente: distinct(prospects, "fuente"),
    }),
    [prospects],
  );
  const rows = useMemo(
    () => sortByLastContact(filterProspects(prospects, filters), sortDir),
    [prospects, filters, sortDir],
  );
  const set = (key: keyof Filters) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="flex flex-col gap-3 md:h-full md:min-h-0">
      <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
        <div className="space-y-1">
          <Label htmlFor="pf-q" className="text-xs">
            Buscar
          </Label>
          <div className="relative">
            <Search
              aria-hidden
              className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="pf-q"
              value={filters.q}
              onChange={(e) => set("q")(e.target.value)}
              placeholder="Nombre, correo, teléfono…"
              className="pl-8"
            />
          </div>
        </div>
        <FilterSelect
          id="pf-estado"
          label="Estado"
          value={filters.estado}
          options={STATE_OPTIONS}
          onChange={set("estado")}
        />
        <FilterSelect
          id="pf-rubro"
          label="Rubro"
          value={filters.rubro}
          options={options.rubro}
          onChange={set("rubro")}
        />
        <FilterSelect
          id="pf-comuna"
          label="Comuna"
          value={filters.comuna}
          options={options.comuna}
          onChange={set("comuna")}
        />
        <FilterSelect
          id="pf-fuente"
          label="Fuente"
          value={filters.fuente}
          options={options.fuente}
          onChange={set("fuente")}
        />
        <Button variant="ghost" disabled={!hasFilters} onClick={() => setFilters(EMPTY_FILTERS)}>
          Limpiar
        </Button>
      </div>

      <p className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
        {rows.length} de {prospects.length} prospectos
      </p>

      {rows.length === 0 ? (
        <EmptyState size="compact" title="Sin resultados" description="Prueba con otros filtros." />
      ) : (
        <div className="overflow-x-auto rounded-app-lg border border-border-subtle bg-surface md:min-h-0 md:flex-1 md:overflow-y-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10 bg-surface-2 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Negocio
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Rubro · Comuna
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Fuente
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 font-medium"
                  aria-sort={sortDir === "asc" ? "ascending" : "descending"}
                >
                  <button
                    type="button"
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="inline-flex items-center gap-1 rounded-app-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Último contacto
                    {sortDir === "asc" ? (
                      <ArrowUp aria-hidden className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDown aria-hidden className="h-3.5 w-3.5" />
                    )}
                    <span className="sr-only">
                      {sortDir === "asc" ? "(más antiguo primero)" : "(más reciente primero)"}
                    </span>
                  </button>
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Estado
                </th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    "border-t border-border-subtle",
                    p.estado === "baja" && "bg-danger-subtle/40",
                  )}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => actions.onOpen(p)}
                      className="text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {p.nombre}
                    </button>
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      <NoContactBadge prospect={p} />
                      <MarketingBadge prospect={p} />
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[p.rubro, p.comuna].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td
                    className="max-w-[220px] truncate px-3 py-2 text-muted-foreground"
                    title={p.fuente}
                  >
                    {p.fuente}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatShortDate(p.ultimo_contacto)}</td>
                  <td className="px-3 py-2">
                    <StageSelect prospect={p} onMove={actions.onMove} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <ConvertAction
                        prospect={p}
                        onConvert={actions.onConvert}
                        label="Convertir en cliente"
                      />
                      <ResumeAction prospect={p} onMove={actions.onMove} />
                      <CreateProposalAction prospect={p} className="h-11 w-11" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
