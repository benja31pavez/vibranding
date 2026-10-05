import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronsUpDown, Users } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClientAvatar } from "./ClientAvatar";
import { useClientList, type ClientSummary } from "./useClientList";

interface ClientSwitcherProps {
  activeClient: ClientSummary | null;
}

/**
 * Selector del cliente activo: muestra el cliente y permite cambiarlo.
 * Desconectarlo se hace desde Clientes (menú "⋯" de la tarjeta).
 */
export function ClientSwitcher({ activeClient }: ClientSwitcherProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: clients, isLoading, isError } = useClientList(open);

  const goToClient = (clientId: string) => {
    setOpen(false);
    navigate({ to: "/clients/$clientId", params: { clientId } });
  };

  const goToList = () => {
    setOpen(false);
    navigate({ to: "/clients" });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            activeClient
              ? `Cliente activo: ${activeClient.name}. Cambiar de cliente`
              : "Seleccionar cliente"
          }
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background px-2 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {activeClient ? (
            <>
              <ClientAvatar name={activeClient.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium leading-tight">
                  {activeClient.name}
                </span>
                {activeClient.instagram_handle && (
                  <span className="block truncate text-xs leading-tight text-muted-foreground">
                    @{activeClient.instagram_handle}
                  </span>
                )}
              </span>
            </>
          ) : (
            <>
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground"
              >
                <Users className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                Seleccionar cliente
              </span>
            </>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente…" />
          <CommandList>
            {isLoading && (
              <div className="px-3 py-4 text-sm text-muted-foreground">Cargando clientes…</div>
            )}
            {isError && (
              <div role="alert" className="px-3 py-4 text-sm text-destructive">
                No se pudieron cargar los clientes.
              </div>
            )}
            {!isLoading && !isError && <CommandEmpty>Sin resultados.</CommandEmpty>}
            {clients && clients.length > 0 && (
              <CommandGroup heading="Clientes">
                {clients.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${c.instagram_handle ?? ""} ${c.id}`}
                    onSelect={() => goToClient(c.id)}
                  >
                    <ClientAvatar name={c.name} className="h-6 w-6 text-[11px]" />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {activeClient?.id === c.id && <Check className="h-4 w-4" aria-label="Activo" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem value="ver todos los clientes" onSelect={goToList}>
                <Users className="h-4 w-4" /> Ver todos los clientes
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
