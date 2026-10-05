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
import { StatusBadge } from "@/components/app";
import { HealthBadge } from "@/components/clients/health";
import { CLIENT_STATUS_META, isClientStatus } from "@/components/clients/ficha/fichaQueries";
import type { ClientHealth } from "@/lib/health";
import { cn } from "@/lib/utils";
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
  const stage = isClientStatus(c.status) ? CLIENT_STATUS_META[c.status] : null;
  // El motivo más grave, a la vista (la pastilla sola no dice qué pasa).
  const topReason = h && h.level !== "bien" ? (h.reasons[0] ?? null) : null;
  return (
    <div className="relative h-full rounded-app-lg border border-border-subtle bg-surface px-4 py-3 shadow-app-xs transition-shadow hover:border-border-strong hover:shadow-app-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="min-w-0 text-base font-semibold leading-snug">
            <Link
              to="/clients/$clientId"
              params={{ clientId: c.id }}
              title={c.name}
              className="line-clamp-2 break-words after:absolute after:inset-0 after:rounded-app-lg focus-visible:outline-none"
            >
              {c.name}
            </Link>
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
                <span className="ml-auto text-xs text-muted-foreground">No está en el panel</span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5">
        {stage && (
          <StatusBadge status={`cliente_${c.status}`} label={stage.label} tone={stage.tone} />
        )}
        <HealthBadge health={h} loading={healthLoading} className="inline-flex" />
        {isActive && (
          <span
            title="Es el cliente elegido en el panel izquierdo"
            className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            En el panel
          </span>
        )}
      </div>
      {topReason && (
        <p
          className={cn(
            "mt-2 line-clamp-2 text-xs",
            topReason.severity === "risk" ? "text-danger-strong" : "text-muted-foreground",
          )}
        >
          {topReason.label}
        </p>
      )}
    </div>
  );
}
