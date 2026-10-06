import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FilterX, Inbox } from "lucide-react";
import { useMemo } from "react";
import { ApprovalRow } from "@/components/approvals/ApprovalRow";
import {
  EmptyState,
  ErrorState,
  FitList,
  FitPage,
  ListSkeleton,
  PageHeader,
  Panel,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  useApprovalAction,
  useApprovalQueue,
  type ApprovalAction,
} from "@/hooks/use-approval-queue";
import { cn } from "@/lib/utils";
import {
  APPROVAL_KINDS,
  clientOptions,
  filterApprovals,
  groupApprovals,
  isApprovalKind,
  itemKey,
  type ApprovalFilters,
  type ApprovalGroup,
  type ApprovalItem,
  type ApprovalKind,
  type GroupBy,
} from "@/lib/approvals";

interface ApprovalsSearch {
  tipo?: ApprovalKind;
  cliente?: string;
  agrupar?: "tipo";
}

export const Route = createFileRoute("/_app/approvals")({
  validateSearch: (s: Record<string, unknown>): ApprovalsSearch => ({
    tipo: typeof s.tipo === "string" && isApprovalKind(s.tipo) ? s.tipo : undefined,
    cliente: typeof s.cliente === "string" && s.cliente ? s.cliente : undefined,
    agrupar: s.agrupar === "tipo" ? "tipo" : undefined,
  }),
  component: ApprovalsPage,
  head: () => ({
    meta: [
      { title: "Aprobaciones · Vibranding" },
      {
        name: "description",
        content:
          "Bandeja única de entregables, posts de Instagram y propuestas pendientes de aprobación.",
      },
    ],
  }),
});

const ALL = "all";

/** Columnas por tipo en escritorio (una por tipo con pendientes). */
const KIND_COLS: Readonly<Record<number, string>> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

/** Etiquetas cortas para los chips de tipo (los títulos de columna usan las largas). */
const KIND_CHIP_LABEL: Readonly<Record<ApprovalKind, string>> = {
  entregable: "Entregables",
  post_instagram: "Posts",
  propuesta: "Propuestas",
};

const plural = (n: number) => `${n} ${n === 1 ? "pendiente" : "pendientes"}`;

function ApprovalsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/approvals" });
  const { items, count, isPending, isError, error, refetch, isRefetching } = useApprovalQueue();
  const action = useApprovalAction();

  const groupBy: GroupBy = search.agrupar === "tipo" ? "kind" : "client";
  const clients = useMemo(() => clientOptions(items), [items]);
  // Un ?cliente= que no está en la cola (id viejo o inventado) se ignora.
  const clientId =
    search.cliente && clients.some((c) => c.id === search.cliente) ? search.cliente : ALL;
  const filters = useMemo(
    (): ApprovalFilters => ({ kind: search.tipo ?? ALL, clientId }),
    [search.tipo, clientId],
  );
  const hasFilters = filters.kind !== ALL || filters.clientId !== ALL;

  // Conteo por tipo respetando el filtro de cliente (para los chips de tipo).
  const kindCounts = useMemo(() => {
    const byClient = filterApprovals(items, { kind: ALL, clientId });
    return {
      all: byClient.length,
      ...Object.fromEntries(
        APPROVAL_KINDS.map((k) => [k, byClient.filter((i) => i.kind === k).length]),
      ),
    } as Record<ApprovalKind | typeof ALL, number>;
  }, [items, clientId]);

  const groups = useMemo(
    () => groupApprovals(filterApprovals(items, filters), groupBy),
    [items, filters, groupBy],
  );

  const setSearch = (patch: Partial<ApprovalsSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const clearFilters = () => setSearch({ tipo: undefined, cliente: undefined });
  const onAction = (a: ApprovalAction) => action.mutate(a);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={filters.kind}
        onValueChange={(v) => v && setSearch({ tipo: isApprovalKind(v) ? v : undefined })}
        aria-label="Filtrar por tipo"
        className="flex-wrap justify-start"
      >
        <ToggleGroupItem value={ALL} className="h-9 gap-1.5 px-3 text-xs">
          Todos
          <span className="tabular-nums opacity-70">{kindCounts.all}</span>
        </ToggleGroupItem>
        {APPROVAL_KINDS.map((k) => (
          <ToggleGroupItem key={k} value={k} className="h-9 gap-1.5 px-3 text-xs">
            {KIND_CHIP_LABEL[k]}
            <span className="tabular-nums opacity-70">{kindCounts[k]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Select
        value={filters.clientId}
        onValueChange={(v) => setSearch({ cliente: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="h-9 w-full sm:w-[220px]" aria-label="Filtrar por cliente">
          <SelectValue placeholder="Todos los clientes" />
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

      {hasFilters && (
        <Button size="sm" variant="ghost" onClick={clearFilters}>
          <FilterX aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Limpiar filtros
        </Button>
      )}

      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={groupBy}
        onValueChange={(v) => v && setSearch({ agrupar: v === "kind" ? "tipo" : undefined })}
        aria-label="Agrupar por"
        className="md:ml-auto"
      >
        <ToggleGroupItem value="client" className="h-9 px-3 text-xs">
          Por cliente
        </ToggleGroupItem>
        <ToggleGroupItem value="kind" className="h-9 px-3 text-xs">
          Por tipo
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <FitPage
        header={
          <PageHeader
            size="compact"
            title="Aprobaciones"
            description={!isPending && count > 0 ? plural(count) : undefined}
          />
        }
        contentClassName="flex flex-col gap-4"
      >
        <div className="shrink-0">{toolbar}</div>
        {isPending ? (
          <Panel fill>
            <ListSkeleton rows={6} label="Cargando aprobaciones" />
          </Panel>
        ) : isError ? (
          <ErrorState
            title="No pudimos cargar las aprobaciones"
            message={error instanceof Error ? error.message : undefined}
            onRetry={() => refetch()}
            retrying={isRefetching}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={hasFilters ? "Nada con estos filtros" : "Bandeja al día"}
            action={
              hasFilters ? (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        ) : groupBy === "kind" ? (
          <div
            className={cn("grid gap-4 md:min-h-0 md:flex-1", KIND_COLS[Math.min(groups.length, 3)])}
          >
            {groups.map((group) => (
              <GroupPanel
                key={group.key}
                group={group}
                showClient={filters.clientId === ALL}
                showKind={false}
                onAction={onAction}
              />
            ))}
          </div>
        ) : (
          <ClientList
            groups={groups}
            showClient={filters.clientId === ALL}
            showKind={filters.kind === ALL}
            onAction={onAction}
          />
        )}
      </FitPage>
    </TooltipProvider>
  );
}

interface ListProps {
  showClient: boolean;
  showKind: boolean;
  onAction: (a: ApprovalAction) => void;
}

function rowRenderer({ showClient, showKind, onAction }: ListProps) {
  return function renderApproval(item: ApprovalItem) {
    return (
      <ApprovalRow item={item} showClient={showClient} showKind={showKind} onAction={onAction} />
    );
  };
}

/** Por tipo: una columna por tipo, cada una con su lista a pantalla. */
function GroupPanel({ group, ...props }: ListProps & { group: ApprovalGroup }) {
  return (
    <Panel
      fill
      title={
        <span className="flex items-center gap-2">
          {group.label}
          <span className="text-xs font-normal tabular-nums text-muted-foreground">
            {group.items.length}
          </span>
        </span>
      }
      bodyClassName="pb-3"
    >
      <FitList
        items={group.items}
        getKey={itemKey}
        label={group.label}
        mobileShowAll
        renderItem={rowRenderer(props)}
      />
    </Panel>
  );
}

/** Por cliente: una sola lista ordenada por cliente (alfabético) y, dentro, de más antiguo a más nuevo. */
function ClientList({ groups, ...props }: ListProps & { groups: readonly ApprovalGroup[] }) {
  const items = groups.flatMap((g) => g.items);
  return (
    <Panel fill bodyClassName="pb-3">
      <FitList
        items={items}
        getKey={itemKey}
        label="Por aprobar"
        sheetDescription="Ordenadas por cliente y, dentro de cada uno, de la más antigua a la más nueva."
        mobileShowAll
        renderItem={rowRenderer(props)}
      />
    </Panel>
  );
}
