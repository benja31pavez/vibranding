import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Instagram, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FitList,
  FitPage,
  PageHeader,
} from "@/components/app";
import { HEALTH_LOAD_ERROR, HealthBadge, useClientsHealth } from "@/components/clients/health";
import { HEALTH_LEVEL_META, type HealthLevel } from "@/lib/health";
import {
  disconnectActiveClient,
  useStoredActiveClientId,
} from "@/components/shell/activeClientStore";
import {
  SORT_LABEL,
  arrangeClients,
  useClientsList,
  type ClientListItem,
  type LevelFilter,
  type SortMode,
} from "./clientsListData";
import { ClientCard } from "./ClientCard";
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
  const activeClientId = useStoredActiveClientId();
  const [disconnecting, setDisconnecting] = useState<ClientListItem | null>(null);
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
                  isActive={c.id === activeClientId}
                  onDisconnect={setDisconnecting}
                />
              )}
            />
          )}
        </>
      )}
      <ConfirmDialog
        open={disconnecting !== null}
        onOpenChange={(o) => !o && setDisconnecting(null)}
        title={`¿Desconectar ${disconnecting?.name ?? "este cliente"}?`}
        description="El panel izquierdo dejará de mostrar sus secciones. No se borra ningún dato: puedes volver a elegirlo cuando quieras desde el selector o su tarjeta."
        confirmLabel="Desconectar"
        onConfirm={() => {
          disconnectActiveClient();
          setDisconnecting(null);
        }}
      />
    </FitPage>
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
