import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { filterClients, type ClientSearchEntry } from "@/lib/clients/clientSearch";
import { cn } from "@/lib/utils";
import { ClientSearchResults } from "./ClientSearchResults";
import { useClientSearchIndex } from "./useClientSearchIndex";
import { useSearchShortcut, useShortcutKeys } from "./useSearchShortcut";

/** Igual a la duración de la transición de ancho (duration-200). */
const COLLAPSE_MS = 200;
/** Del borde inferior del botón (h-9 centrado en el header h-14 + borde) al borde del header. */
const MOBILE_SIDE_OFFSET_PX = 11;
const PLACEHOLDER = "Buscar por marca o persona…";

export interface HeaderSearchViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: readonly ClientSearchEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onSelectClient: (clientId: string) => void;
}

/**
 * Mantiene montada la caja de búsqueda mientras se contrae y la expande un frame después de
 * montarla, para que la transición de ancho se vea al abrir y al cerrar.
 */
function useExpansion(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!open) {
      setExpanded(false);
      const timer = window.setTimeout(() => setMounted(false), COLLAPSE_MS);
      return () => window.clearTimeout(timer);
    }
    setMounted(true);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setExpanded(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [open]);
  return { mounted: open || mounted, expanded: open && expanded };
}

function isInside(node: Node | null, ...containers: (HTMLElement | null)[]) {
  return Boolean(node) && containers.some((c) => c?.contains(node));
}

/**
 * Buscador del header anclado al botón "Buscar": al abrir, el botón se expande en el mismo
 * lugar a un campo de ~360px y los resultados aparecen justo debajo, alineados a la derecha.
 * En móvil (<768px) el panel ocupa todo el ancho bajo el header y lleva el campo dentro.
 */
export function HeaderSearchView({
  open,
  onOpenChange,
  clients,
  isLoading,
  isError,
  onSelectClient,
}: HeaderSearchViewProps) {
  const isMobile = useIsMobile();
  const keys = useShortcutKeys();
  const [query, setQuery] = useState("");
  const anchorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mounted, expanded } = useExpansion(open && !isMobile);
  const results = useMemo(() => filterClients(clients ?? [], query), [clients, query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  // Al cerrar (Esc, clic fuera, ⌘K) el foco vuelve al botón, salvo que el usuario ya lo haya
  // llevado a otro elemento (Tab o clic en algo enfocable).
  const restoreFocus = useCallback((event: Event) => {
    event.preventDefault();
    const active = document.activeElement;
    const focusLost = !active || active === document.body;
    if (focusLost || isInside(active, anchorRef.current, contentRef.current)) {
      buttonRef.current?.focus();
    }
  }, []);

  const handleBlur = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (!open || !next || isInside(next, anchorRef.current, contentRef.current)) return;
    onOpenChange(false);
  };

  const input = (
    <div className={cn("flex items-center gap-2 px-3", isMobile ? "h-12 border-b" : "h-full")}>
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <CommandPrimitive.Input
        ref={inputRef}
        value={query}
        onValueChange={setQuery}
        placeholder={PLACEHOLDER}
        aria-label="Buscar clientes"
        className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );

  const showCommand = isMobile ? open : mounted;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative h-9 w-9 shrink-0 sm:w-24">
          <Button
            ref={buttonRef}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(!open)}
            aria-label="Buscar clientes"
            aria-keyshortcuts={keys}
            aria-expanded={open}
            aria-haspopup="listbox"
            tabIndex={open && !isMobile ? -1 : undefined}
            className={cn(
              "h-9 w-full gap-2 px-0 text-muted-foreground sm:px-3",
              showCommand && !isMobile && "opacity-0",
            )}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Buscar</span>
          </Button>
          {showCommand && (
            <Command
              shouldFilter={false}
              label="Buscar clientes"
              onBlur={handleBlur}
              className={
                isMobile
                  ? "contents"
                  : cn(
                      "absolute right-0 top-0 z-10 h-9 overflow-visible rounded-md border border-input bg-background text-foreground shadow-sm transition-[width] duration-200 ease-out motion-reduce:transition-none",
                      expanded ? "w-[360px] max-w-[calc(100vw-2rem)]" : "w-full",
                      !open && "pointer-events-none",
                    )
              }
            >
              {!isMobile && input}
              <PopoverContent
                ref={contentRef}
                align="end"
                sideOffset={isMobile ? MOBILE_SIDE_OFFSET_PX : 6}
                collisionPadding={isMobile ? 0 : 16}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={restoreFocus}
                onInteractOutside={(e) => {
                  if (isInside(e.target as Node, anchorRef.current)) e.preventDefault();
                }}
                className={cn(
                  "overflow-hidden p-0",
                  isMobile
                    ? "w-screen max-w-none rounded-none border-x-0 border-t-0"
                    : "w-[360px] max-w-[calc(100vw-2rem)]",
                )}
              >
                {isMobile && input}
                <CommandList
                  className={cn(
                    "py-1",
                    isMobile ? "max-h-[min(70dvh,480px)]" : "max-h-[min(60vh,420px)]",
                  )}
                >
                  <ClientSearchResults
                    results={results}
                    hasClients={(clients?.length ?? 0) > 0}
                    isLoading={isLoading}
                    isError={isError}
                    onSelect={onSelectClient}
                  />
                </CommandList>
              </PopoverContent>
            </Command>
          )}
        </div>
      </PopoverAnchor>
    </Popover>
  );
}

interface HeaderSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Debe ser estable (useCallback) para no re-suscribir el atajo en cada render. */
  onToggle: () => void;
}

/** Buscador del header: solo clientes, por marca o por persona de contacto. */
export function HeaderSearch({ open, onOpenChange, onToggle }: HeaderSearchProps) {
  const navigate = useNavigate();
  const { data: clients, isLoading, isError } = useClientSearchIndex(open);

  useSearchShortcut(onToggle);

  const goToClient = (clientId: string) => {
    onOpenChange(false);
    navigate({ to: "/clients/$clientId", params: { clientId } });
  };

  return (
    <HeaderSearchView
      open={open}
      onOpenChange={onOpenChange}
      clients={clients}
      isLoading={isLoading}
      isError={isError}
      onSelectClient={goToClient}
    />
  );
}
