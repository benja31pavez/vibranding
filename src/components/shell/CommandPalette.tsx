import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ClientAvatar } from "./ClientAvatar";
import { PRIMARY_NAV, SETTINGS_NAV, type NavItem } from "./navConfig";
import { useClientList } from "./useClientList";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMMAND_CLASSES =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5";

/** Atajo global ⌘K / Ctrl+K para abrir o cerrar la paleta. */
function useCommandShortcut(onToggle: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onToggle]);
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { data: clients, isLoading, isError } = useClientList(open);

  useCommandShortcut(() => onOpenChange(!open));

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  const goToClient = (clientId: string) => {
    onOpenChange(false);
    navigate({ to: "/clients/$clientId", params: { clientId } });
  };

  const renderNavItem = (item: NavItem) => (
    <CommandItem
      key={item.to}
      value={`${item.label} ${item.to}`}
      keywords={item.keywords}
      onSelect={() => go(item.to)}
    >
      <item.icon className="h-4 w-4" />
      {item.label}
    </CommandItem>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Buscar en la plataforma</DialogTitle>
        <DialogDescription className="sr-only">
          Escribe para buscar clientes o secciones y presiona Enter para ir.
        </DialogDescription>
        <Command className={COMMAND_CLASSES}>
          <CommandInput placeholder="Buscar clientes o secciones…" />
          <CommandList className="max-h-[min(60vh,420px)]">
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup heading="Clientes">
              {isLoading && (
                <div className="px-2 py-2 text-sm text-muted-foreground">Cargando clientes…</div>
              )}
              {isError && (
                <div role="alert" className="px-2 py-2 text-sm text-destructive">
                  No se pudieron cargar los clientes.
                </div>
              )}
              {clients?.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.instagram_handle ?? ""} ${c.id}`}
                  onSelect={() => goToClient(c.id)}
                >
                  <ClientAvatar name={c.name} className="h-6 w-6 text-[11px]" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {c.instagram_handle && (
                    <span className="truncate text-xs text-muted-foreground">@{c.instagram_handle}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Ir a">{PRIMARY_NAV.map(renderNavItem)}</CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Configuración">{SETTINGS_NAV.map(renderNavItem)}</CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
