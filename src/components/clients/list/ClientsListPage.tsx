import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
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
  InfoHint,
  PageHeader,
} from "@/components/app";
import { HEALTH_LOAD_ERROR, useClientsHealth } from "@/components/clients/health";
import { HEALTH_LEVEL_META, type HealthLevel } from "@/lib/health";
import {
  disconnectActiveClient,
  useStoredActiveClientId,
} from "@/components/shell/activeClientStore";
import {
  SORT_LABEL,
  arrangeClients,
  summarizePortfolio,
  useClientsList,
  type ClientListItem,
  type LevelFilter,
  type SortMode,
  type StageFilter,
} from "./clientsListData";
import { ClientCard } from "./ClientCard";
import { StageChips } from "./StageChips";
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
  const [stage, setStage] = useState<StageFilter>("all");
  const [open, setOpen] = useState(false);
  const activeClientId = useStoredActiveClientId();
  const [disconnecting, setDisconnecting] = useState<ClientListItem | null>(null);
  const clients = query.data;

  const visible = useMemo(
    () => arrangeClients(clients ?? [], health.data, sort, level, stage),
    [clients, health.data, sort, level, stage],
  );
  const summary = useMemo(
    () => summarizePortfolio(clients ?? [], health.data),
    [clients, health.data],
  );
  const levelCount = (k: HealthLevel): number | null =>
    k === "en_riesgo" ? summary.enRiesgo : k === "atencion" ? summary.atencion : null;
  const clearFilters = () => {
    setStage("all");
    setLevel("all");
  };

  return (
    <FitPage
      header={
        <PageHeader
          size="compact"
          title="Clientes"
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
          icon={Users}
          title="Aún no tienes clientes"
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus aria-hidden className="mr-1 h-4 w-4" /> Nuevo cliente
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <StageChips
              value={stage}
              onChange={setStage}
              total={clients?.length ?? 0}
              counts={summary.byStage}
            />
            <div className="flex flex-wrap items-center gap-2 md:ml-auto">
              <Select
                value={level}
                onValueChange={(v) => setLevel(v as LevelFilter)}
                disabled={!health.data}
              >
                <SelectTrigger className="h-9 w-[170px]" aria-label="Filtrar por salud">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda la salud</SelectItem>
                  {(Object.keys(HEALTH_LEVEL_META) as HealthLevel[]).map((k) => {
                    const n = levelCount(k);
                    return (
                      <SelectItem key={k} value={k}>
                        {HEALTH_LEVEL_META[k].label}
                        {n !== null && n > 0 ? ` (${n})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                <SelectTrigger className="h-9 w-[170px]" aria-label="Ordenar clientes">
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
              <InfoHint label="Cómo se calcula la salud" align="end">
                La salud se calcula para clientes en onboarding, activos y pausados. Los prospectos
                y terminados no se puntúan.
              </InfoHint>
            </div>
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
            <div className="flex flex-col items-center gap-3 rounded-app-lg border border-dashed border-border-subtle p-6 text-center text-sm text-muted-foreground">
              Ningún cliente con estos filtros.
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Ver todos
              </Button>
            </div>
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
