import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FilterX, Inbox } from "lucide-react";
import { useMemo } from "react";
import { ApprovalRow } from "@/components/approvals/ApprovalRow";
import { EmptyState, ErrorState, ListSkeleton, PageContainer, PageHeader, Panel } from "@/components/app";
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
import { useApprovalAction, useApprovalQueue } from "@/hooks/use-approval-queue";
import {
  APPROVAL_KINDS,
  APPROVAL_KIND_LABEL_PLURAL,
  clientOptions,
  filterApprovals,
  groupApprovals,
  isApprovalKind,
  type ApprovalFilters,
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

  const groups = useMemo(
    () => groupApprovals(filterApprovals(items, filters), groupBy),
    [items, filters, groupBy],
  );

  const setSearch = (patch: Partial<ApprovalsSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const clearFilters = () => setSearch({ tipo: undefined, cliente: undefined });

  return (
    <TooltipProvider delayDuration={150}>
      <PageContainer className="space-y-6">
        <PageHeader
          title="Aprobaciones"
          description={
            isPending
              ? "Todo lo que espera tu visto bueno, en un solo lugar."
              : count === 0
                ? "No hay nada esperando tu visto bueno."
                : `${count} ${count === 1 ? "pendiente" : "pendientes"} de revisión.`
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={groupBy}
            onValueChange={(v) => v && setSearch({ agrupar: v === "kind" ? "tipo" : undefined })}
            aria-label="Agrupar por"
          >
            <ToggleGroupItem value="client">Por cliente</ToggleGroupItem>
            <ToggleGroupItem value="kind">Por tipo</ToggleGroupItem>
          </ToggleGroup>

          <Select
            value={filters.kind}
            onValueChange={(v) => setSearch({ tipo: isApprovalKind(v) ? v : undefined })}
          >
            <SelectTrigger className="h-9 w-[200px]" aria-label="Filtrar por tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los tipos</SelectItem>
              {APPROVAL_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {APPROVAL_KIND_LABEL_PLURAL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.clientId}
            onValueChange={(v) => setSearch({ cliente: v === ALL ? undefined : v })}
          >
            <SelectTrigger className="h-9 w-[200px]" aria-label="Filtrar por cliente">
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
        </div>

        {isPending ? (
          <Panel>
            <ListSkeleton rows={6} label="Cargando aprobaciones…" />
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
            description={
              hasFilters
                ? "Prueba con otro tipo o cliente."
                : "Cuando haya entregables en revisión, posts propuestos o propuestas en borrador, aparecerán aquí."
            }
            action={
              hasFilters ? (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <Panel
                key={group.key}
                title={
                  <span className="flex items-center gap-2">
                    {group.label}
                    <span className="text-sm font-normal tabular-nums text-muted-foreground">
                      {group.items.length}
                    </span>
                  </span>
                }
              >
                <ul className="divide-y divide-border-subtle">
                  {group.items.map((item) => (
                    <ApprovalRow
                      key={`${item.kind}:${item.refId}`}
                      item={item}
                      showClient={groupBy === "kind"}
                      onAction={(a) => action.mutate(a)}
                    />
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        )}
      </PageContainer>
    </TooltipProvider>
  );
}
