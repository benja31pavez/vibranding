import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ClientStatusBadge } from "@/components/clients/ficha/ClientHeader";
import { filterClients, type ClientSearchEntry } from "@/lib/clients/clientSearch";
import { ClientAvatar } from "./ClientAvatar";
import { useClientSearchIndex } from "./useClientSearchIndex";
import { isApplePlatform, isEditableTarget } from "./platform";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Debe ser estable (useCallback) para no re-suscribir el atajo en cada render. */
  onToggle: () => void;
}

const COMMAND_CLASSES =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5";

/**
 * Atajo global (no visible en la UI): ⌘K en Mac, Ctrl+K en el resto. Ignora repeticiones y
 * composición (IME). En campos editables solo responde a ⌘K en Mac, para no pisar Ctrl+K.
 */
function useCommandShortcut(onToggle: () => void) {
  useEffect(() => {
    const apple = isApplePlatform();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing || e.key.toLowerCase() !== "k") return;
      if (e.altKey || e.shiftKey) return;
      const modifier = apple ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
      if (!modifier) return;
      if (!apple && isEditableTarget(e.target)) return;
      e.preventDefault();
      onToggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onToggle]);
}

/** Persona de contacto y, si difiere de la marca, la razón social. */
function secondaryLine(client: ClientSearchEntry): string {
  const legal =
    client.legalName && client.legalName.toLowerCase() !== client.brand.toLowerCase()
      ? client.legalName
      : null;
  return [client.contactName, legal].filter(Boolean).join(" · ");
}

function ClientResult({ client }: { client: ClientSearchEntry }) {
  const secondary = secondaryLine(client);
  return (
    <>
      <ClientAvatar name={client.brand} className="h-7 w-7 text-[11px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{client.brand}</span>
        {secondary && (
          <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
        )}
      </span>
      <ClientStatusBadge status={client.status} />
    </>
  );
}

/** Buscador del header: solo clientes, por marca o por persona de contacto. */
export function CommandPalette({ open, onOpenChange, onToggle }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { data: clients, isLoading, isError } = useClientSearchIndex(open);
  const results = useMemo(() => filterClients(clients ?? [], query), [clients, query]);

  useCommandShortcut(onToggle);

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery("");
    onOpenChange(next);
  };

  const goToClient = (clientId: string) => {
    handleOpenChange(false);
    navigate({ to: "/clients/$clientId", params: { clientId } });
  };

  const hasClients = (clients?.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Buscar clientes</DialogTitle>
        <DialogDescription className="sr-only">
          Escribe el nombre de la marca o de la persona de contacto y presiona Enter para abrir su
          ficha.
        </DialogDescription>
        <Command shouldFilter={false} className={COMMAND_CLASSES}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar por marca o persona…"
          />
          <CommandList className="max-h-[min(60vh,420px)]">
            {isLoading && (
              <div role="status" className="px-4 py-3 text-sm text-muted-foreground">
                Cargando clientes…
              </div>
            )}
            {isError && (
              <div role="alert" className="px-4 py-3 text-sm text-destructive">
                No se pudieron cargar los clientes.
              </div>
            )}
            {!isLoading && !isError && (
              <CommandEmpty>
                {hasClients
                  ? "No encontramos clientes con ese nombre"
                  : "Aún no tienes clientes registrados"}
              </CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Clientes">
                {results.map((c) => (
                  <CommandItem key={c.id} value={c.id} onSelect={() => goToClient(c.id)}>
                    <ClientResult client={c} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
