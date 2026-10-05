import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Instagram, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, FitList, FitPage, PageHeader } from "@/components/app";
import { HEALTH_LOAD_ERROR, HealthBadge, useClientsHealth } from "@/components/clients/health";
import { HEALTH_LEVEL_META, type ClientHealth, type HealthLevel } from "@/lib/health";
import {
  SORT_LABEL,
  arrangeClients,
  useClientsList,
  type ClientListItem,
  type LevelFilter,
  type SortMode,
} from "./clientsListData";
import { NewClientDialog } from "./NewClientDialog";

/** Ancho mínimo de una tarjeta de cliente en la grilla de escritorio (px). */
const CARD_MIN_WIDTH = 260;
const SKELETON_CARDS = 6;

/** Lista de clientes: en escritorio, una pantalla con las tarjetas que caben + paginador. */
export function ClientsListPage() {
  const query = useClientsList();
  const health = useClientsHealth();
  const [sort, setSort] = useState<SortMode>("recent");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [open, setOpen] = useState(false);
  const clients = query.data;

  const visible = useMemo(
    () => arrangeClients(clients ?? [], health.data, sort, level),
    [clients, health.data, sort, level],
  );

  return (
    <FitPage
      header={
        <PageHeader
          size="compact"
          title="Clientes"
          description="Gestiona las asesorías de cada uno."
          actions={
            <>
              <Button asChild variant="outline">
                <Link to="/clients/connect">Conectar con Meta</Link>
              </Button>
              <NewClientDialog open={open} onOpenChange={setOpen} />
            </>
          }
        />
      }
      contentClassName="flex flex-col gap-3"
    >
      {clients === undefined && !query.isError ? (
        <CardsSkeleton />
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : clients && clients.length === 0 ? (
        <EmptyState
          icon={Instagram}
          title="Aún no tienes clientes"
          description="Crea tu primer cliente para empezar."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus aria-hidden className="mr-1 h-4 w-4" /> Nuevo cliente
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
              <SelectTrigger className="h-9 w-[180px]" aria-label="Ordenar clientes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABEL) as SortMode[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORT_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={level}
              onValueChange={(v) => setLevel(v as LevelFilter)}
              disabled={!health.data}
            >
              <SelectTrigger className="h-9 w-[180px]" aria-label="Filtrar por salud">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda la salud</SelectItem>
                {(Object.keys(HEALTH_LEVEL_META) as HealthLevel[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {HEALTH_LEVEL_META[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs font-medium tabular-nums text-foreground">
              {visible.length} {visible.length === 1 ? "cliente" : "clientes"}
            </span>
            <span className="text-xs text-muted-foreground">
              · Los prospectos y terminados no se puntúan.
            </span>
            {health.isError && (
              <span role="alert" className="flex items-center gap-2 text-xs text-danger-strong">
                {HEALTH_LOAD_ERROR}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => void health.refetch()}
                  disabled={health.isFetching}
                >
                  Reintentar
                </Button>
              </span>
            )}
          </div>
          {visible.length === 0 ? (
            <p className="rounded-app-lg border border-dashed border-border-subtle p-6 text-center text-sm text-muted-foreground">
              Ningún cliente con salud “{level === "all" ? "" : HEALTH_LEVEL_META[level].label}”.
            </p>
          ) : (
            <FitList
              variant="grid"
              items={visible}
              getKey={(c) => c.id}
              label="Clientes"
              minColWidth={CARD_MIN_WIDTH}
              mobileShowAll
              mobileGridClassName="sm:grid-cols-2"
              renderItem={(c) => (
                <ClientCard
                  client={c}
                  health={health.data?.get(c.id)}
                  healthLoading={health.isPending && !health.isError}
                />
              )}
            />
          )}
        </>
      )}
    </FitPage>
  );
}

function ClientCard({
  client: c,
  health: h,
  healthLoading,
}: {
  client: ClientListItem;
  health: ClientHealth | undefined;
  healthLoading: boolean;
}) {
  return (
    <Link
      to="/clients/$clientId"
      params={{ clientId: c.id }}
      className="group block h-full rounded-app-lg border border-border-subtle bg-surface px-4 py-3 shadow-app-xs transition-shadow hover:border-border-strong hover:shadow-app-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{c.name}</h3>
          <div className="mt-0.5 flex h-5 items-center gap-1 text-sm text-muted-foreground">
            {c.instagram_handle && (
              <>
                <Instagram aria-hidden className="h-3.5 w-3.5" /> @{c.instagram_handle}
              </>
            )}
          </div>
        </div>
        <ArrowRight
          aria-hidden
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
        />
      </div>
      <div className="mt-2 flex min-h-5 items-center gap-2">
        <HealthBadge health={h} loading={healthLoading} />
        {h && h.reasons[0] && (
          <span className="truncate text-xs text-muted-foreground">{h.reasons[0].label}</span>
        )}
      </div>
    </Link>
  );
}

function CardsSkeleton() {
  return (
    <div role="status" aria-busy className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">Cargando clientes</span>
      {Array.from({ length: SKELETON_CARDS }, (_, i) => (
        <div
          key={i}
          className="space-y-2 rounded-app-lg border border-border-subtle bg-surface p-4"
        >
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
