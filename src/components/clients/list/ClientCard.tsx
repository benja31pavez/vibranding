import { Link } from "@tanstack/react-router";
import { ExternalLink, Instagram, MoreHorizontal, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HealthBadge } from "@/components/clients/health";
import type { ClientHealth } from "@/lib/health";
import type { ClientListItem } from "./clientsListData";

interface ClientCardProps {
  client: ClientListItem;
  health: ClientHealth | undefined;
  healthLoading: boolean;
  /** Es el cliente activo del panel izquierdo. */
  isActive: boolean;
  /** Pide confirmar la desconexión (solo cliente activo). */
  onDisconnect: (client: ClientListItem) => void;
}

/** Tarjeta de cliente: toda la tarjeta abre la ficha; el menú "⋯" agrupa las acciones. */
export function ClientCard({
  client: c,
  health: h,
  healthLoading,
  isActive,
  onDisconnect,
}: ClientCardProps) {
  return (
    <div className="relative h-full rounded-app-lg border border-border-subtle bg-surface px-4 py-3 shadow-app-xs transition-shadow hover:border-border-strong hover:shadow-app-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold">
            <Link
              to="/clients/$clientId"
              params={{ clientId: c.id }}
              className="truncate after:absolute after:inset-0 after:rounded-app-lg focus-visible:outline-none"
            >
              {c.name}
            </Link>
            {isActive && (
              <span className="shrink-0 rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-strong">
                Activo
              </span>
            )}
          </h3>
          <div className="mt-0.5 flex h-5 items-center gap-1 text-sm text-muted-foreground">
            {c.instagram_handle && (
              <>
                <Instagram aria-hidden className="h-3.5 w-3.5" /> @{c.instagram_handle}
              </>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative z-10 -mr-2 -mt-1 h-8 w-8 shrink-0 text-muted-foreground"
              aria-label={`Acciones de ${c.name}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link to="/clients/$clientId" params={{ clientId: c.id }}>
                <ExternalLink /> Abrir ficha
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!isActive} onSelect={() => onDisconnect(c)}>
              <Unplug /> Desconectar…
              {!isActive && (
                <span className="ml-auto text-xs text-muted-foreground">No activo</span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex min-h-5 items-center gap-2">
        <HealthBadge health={h} loading={healthLoading} />
        {h && h.reasons[0] && (
          <span className="truncate text-xs text-muted-foreground">{h.reasons[0].label}</span>
        )}
      </div>
    </div>
  );
}
