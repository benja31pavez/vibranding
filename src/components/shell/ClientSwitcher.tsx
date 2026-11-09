import { useEffect, useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronsUpDown, Pin, Plus, Search, Settings2, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ErrorState, ListSkeleton, StatusBadge } from "@/components/app";
import { CLIENT_STATUS_META, isClientStatus } from "@/components/clients/ficha/fichaQueries";
import { NewClientDialog } from "@/components/clients/list/NewClientDialog";
import { cn } from "@/lib/utils";
import { ClientAvatar } from "./ClientAvatar";
import { isClientManagementPath } from "./navConfig";
import { pushRecent, readPinned, readRecent, togglePinned } from "./clientSwitcherPrefs";
import { useClientList, type ClientSummary } from "./useClientList";

interface ClientSwitcherProps {
  activeClient: ClientSummary | null;
}

type StatusFilter = "all" | "activo" | "onboarding" | "pausado" | "terminado" | "prospecto";
type Order = "az" | "recientes";

const STATUS_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Estado: Todos" },
  { value: "activo", label: "Activos" },
  { value: "onboarding", label: "Onboarding" },
  { value: "pausado", label: "Pausados" },
  { value: "terminado", label: "Terminados" },
  { value: "prospecto", label: "Prospectos" },
];

/**
 * Selector del cliente activo (botón del menú lateral) que abre el pop-up
 * "Cambiar de cliente": buscador, filtros, Fijados y Recientes, administrar y crear.
 */
export function ClientSwitcher({ activeClient }: ClientSwitcherProps) {
  const [open, setOpen] = useState(false);

  // Cada visita a un cliente lo deja al frente de "Recientes".
  useEffect(() => {
    if (activeClient?.id) pushRecent(activeClient.id);
  }, [activeClient?.id]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          activeClient
            ? `Cliente activo: ${activeClient.name}. Cambiar de cliente`
            : "Seleccionar cliente"
        }
        className="sb-switcher flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fb2ff]"
      >
        {activeClient ? (
          <>
            <ClientAvatar clientId={activeClient.id} name={activeClient.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium leading-tight">{activeClient.name}</span>
              <span className="sb-muted block truncate text-xs leading-tight">
                {statusLabel(activeClient.status) ?? "Cliente"}
                {activeClient.instagram_handle ? ` · @${activeClient.instagram_handle}` : ""}
              </span>
            </span>
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-white/30"
            >
              <Users className="h-4 w-4" />
            </span>
            <span className="sb-muted min-w-0 flex-1 truncate">Seleccionar cliente</span>
          </>
        )}
        <ChevronsUpDown className="sb-muted h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
      <ClientSwitcherDialog open={open} onOpenChange={setOpen} activeClient={activeClient} />
    </>
  );
}

function statusLabel(status: string | null | undefined): string | null {
  return isClientStatus(status) ? CLIENT_STATUS_META[status].label : null;
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeClient: ClientSummary | null;
}

export function ClientSwitcherDialog({ open, onOpenChange, activeClient }: DialogProps) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: clients, isLoading, isError, refetch, isFetching } = useClientList(open);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [order, setOrder] = useState<Order>("az");
  const [pinned, setPinned] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setPinned(readPinned());
    setRecent(readRecent());
  }, [open]);

  const goToClient = (clientId: string) => {
    onOpenChange(false);
    navigate(
      isClientManagementPath(path)
        ? { to: "/clients/$clientId", params: { clientId } }
        : { to: "/clients/$clientId/ficha", params: { clientId } },
    );
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (clients ?? []).filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) || (c.instagram_handle ?? "").toLowerCase().includes(q)
      );
    });
    if (order === "az") {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, "es"));
    }
    // "Recientes": primero los visitados hace poco, luego el orden de actualización.
    const rank = new Map(recent.map((id, i) => [id, i]));
    return [...list].sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [clients, query, status, order, recent]);

  const pinnedSet = new Set(pinned);
  const pinnedList = filtered.filter((c) => pinnedSet.has(c.id));
  const recentList = filtered.filter(
    (c) => !pinnedSet.has(c.id) && recent.includes(c.id) && c.id !== activeClient?.id,
  );
  const restList = filtered.filter(
    (c) => !pinnedSet.has(c.id) && !recentList.some((r) => r.id === c.id),
  );

  const onTogglePin = (id: string) => setPinned(togglePinned(id));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-[calc(100vw-1.5rem)] max-w-[600px] gap-0 overflow-hidden p-0 sm:rounded-2xl [&>button]:hidden"
          aria-describedby={undefined}
        >
          {/* Barra superior oscura con el cliente activo marcado en azul (como en Nexus). */}
          <div className="flex h-12 items-center bg-[#0F1230] pl-4 text-white">
            <DialogTitle className="text-xs font-extrabold uppercase tracking-[0.14em]">
              Cambiar de cliente
            </DialogTitle>
            <DialogDescription className="sr-only">
              Busca un cliente, fíjalo para tenerlo a mano o crea uno nuevo.
            </DialogDescription>
            <div className="flex-1" />
            {activeClient && (
              <span
                className="flex h-12 max-w-[50%] items-center truncate bg-[#2F6BFF] px-4 text-xs font-bold"
                style={{ clipPath: "polygon(14px 0, 100% 0, 100% 100%, 0 100%)" }}
              >
                Activo: {activeClient.name}
              </span>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Cerrar"
              className="flex h-12 w-12 items-center justify-center bg-[#0F1230] text-white hover:bg-[#1C1F47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex min-h-0 flex-col bg-background sm:flex-row">
            <nav
              aria-label="Tipo de espacio"
              className="flex gap-1 bg-[#141737] p-2 sm:w-36 sm:flex-col"
            >
              <span className="flex items-center gap-2 rounded-lg bg-[#2F6BFF] px-3 py-2 text-sm font-semibold text-white">
                <Users className="h-4 w-4" aria-hidden="true" /> Clientes
              </span>
            </nav>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="space-y-2.5 px-3 pt-3">
                <label className="flex h-9 items-center gap-2 rounded-lg border-[1.5px] border-[#2F6BFF] px-2.5 text-muted-foreground">
                  <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <input
                    type="search"
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar cliente"
                    aria-label="Buscar cliente"
                    className="h-full w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </label>
                <div className="flex gap-2">
                  <select
                    aria-label="Filtrar por estado"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusFilter)}
                    className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2 text-xs font-semibold text-foreground"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Ordenar"
                    value={order}
                    onChange={(e) => setOrder(e.target.value as Order)}
                    className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2 text-xs font-semibold text-foreground"
                  >
                    <option value="az">Orden: A–Z</option>
                    <option value="recientes">Orden: Recientes</option>
                  </select>
                </div>
              </div>

              <div className="max-h-[52vh] min-h-[200px] overflow-y-auto px-3 pb-2 pt-1">
                {isLoading && <ListSkeleton rows={4} label="Cargando clientes" />}
                {isError && (
                  <ErrorState
                    title="No se pudieron cargar los clientes"
                    onRetry={() => void refetch()}
                    retrying={isFetching}
                  />
                )}
                {!isLoading && !isError && filtered.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Sin resultados.
                  </p>
                )}
                {pinnedList.length > 0 && (
                  <Group title="Fijados">
                    {pinnedList.map((c) => (
                      <ClientRow
                        key={c.id}
                        client={c}
                        active={c.id === activeClient?.id}
                        pinned
                        onSelect={goToClient}
                        onTogglePin={onTogglePin}
                      />
                    ))}
                  </Group>
                )}
                {recentList.length > 0 && (
                  <Group title="Recientes">
                    {recentList.map((c) => (
                      <ClientRow
                        key={c.id}
                        client={c}
                        active={c.id === activeClient?.id}
                        pinned={false}
                        onSelect={goToClient}
                        onTogglePin={onTogglePin}
                      />
                    ))}
                  </Group>
                )}
                {restList.length > 0 && (
                  <Group title={pinnedList.length + recentList.length > 0 ? "Todos" : undefined}>
                    {restList.map((c) => (
                      <ClientRow
                        key={c.id}
                        client={c}
                        active={c.id === activeClient?.id}
                        pinned={false}
                        onSelect={goToClient}
                        onTogglePin={onTogglePin}
                      />
                    ))}
                  </Group>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t px-3 py-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    onOpenChange(false);
                    navigate({ to: "/clients" });
                  }}
                >
                  <Settings2 className="h-4 w-4" aria-hidden="true" /> Administrar clientes
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo cliente
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <NewClientDialog
        hideTrigger
        open={creating}
        onOpenChange={(o) => {
          setCreating(o);
          if (!o) onOpenChange(false);
        }}
      />
    </>
  );
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={title}>
      {title && (
        <div className="px-3 pb-1 pt-3 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </div>
      )}
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function ClientRow({
  client,
  active,
  pinned,
  onSelect,
  onTogglePin,
}: {
  client: ClientSummary;
  active: boolean;
  pinned: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const st = isClientStatus(client.status) ? client.status : null;
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-lg border-l-[3px] pr-1",
        active ? "border-[#2F6BFF] bg-brand-soft" : "border-transparent hover:bg-muted/60",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(client.id)}
        aria-current={active ? "true" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ClientAvatar clientId={client.id} name={client.name} className="h-8 w-8" />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm font-semibold",
              active ? "text-[#2F6BFF]" : "text-foreground",
            )}
          >
            {client.name}
          </span>
          {client.instagram_handle && (
            <span className="block truncate text-xs text-muted-foreground">
              @{client.instagram_handle}
            </span>
          )}
        </span>
        {st && (
          <StatusBadge
            status={st}
            label={CLIENT_STATUS_META[st].label}
            tone={CLIENT_STATUS_META[st].tone}
          />
        )}
      </button>
      <button
        type="button"
        onClick={() => onTogglePin(client.id)}
        aria-pressed={pinned}
        aria-label={pinned ? `Dejar de fijar a ${client.name}` : `Fijar a ${client.name}`}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          pinned ? "text-[#2F6BFF]" : "text-muted-foreground/60 hover:text-foreground",
        )}
      >
        <Pin className={cn("h-4 w-4", pinned && "fill-current")} aria-hidden="true" />
      </button>
    </li>
  );
}
