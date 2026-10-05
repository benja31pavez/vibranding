import { CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ClientStatusBadge } from "@/components/clients/ficha/ClientHeader";
import type { ClientSearchEntry } from "@/lib/clients/clientSearch";
import { ClientAvatar } from "./ClientAvatar";

interface ClientSearchResultsProps {
  results: readonly ClientSearchEntry[];
  hasClients: boolean;
  isLoading: boolean;
  isError: boolean;
  onSelect: (clientId: string) => void;
}

/**
 * Fila resaltada con fondo claro y texto oscuro: sobre el azul de `accent` las iniciales del
 * avatar (texto `primary`) y el texto secundario dejaban de leerse.
 */
const ITEM_CLASSES =
  "group gap-3 px-2 py-2.5 data-[selected=true]:bg-muted data-[selected=true]:text-foreground";

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
      <ClientAvatar
        name={client.brand}
        className="h-7 w-7 text-[11px] group-data-[selected=true]:bg-background group-data-[selected=true]:ring-1 group-data-[selected=true]:ring-primary/20"
      />
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

/** Contenido de la lista del buscador: estados de carga/error/vacío y clientes. */
export function ClientSearchResults({
  results,
  hasClients,
  isLoading,
  isError,
  onSelect,
}: ClientSearchResultsProps) {
  return (
    <>
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
            <CommandItem
              key={c.id}
              value={c.id}
              onSelect={() => onSelect(c.id)}
              className={ITEM_CLASSES}
            >
              <ClientResult client={c} />
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </>
  );
}
