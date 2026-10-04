import { ClientSidebarNav } from "@/components/clients/ClientSidebarNav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClientSwitcher } from "./ClientSwitcher";
import type { ClientSummary } from "./useClientList";

interface ClientSidebarProps {
  activeClient: ClientSummary | null;
  path: string;
  staleOutcomes: number;
  onDisconnect: () => void;
}

/** Contenido del panel izquierdo (gestión de UN cliente). Se usa en el aside y en el Sheet móvil. */
export function ClientSidebar({ activeClient, path, staleOutcomes, onDisconnect }: ClientSidebarProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b px-3 py-3">
          <ClientSwitcher activeClient={activeClient} onDisconnect={onDisconnect} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {activeClient ? (
            <ClientSidebarNav clientId={activeClient.id} path={path} staleOutcomes={staleOutcomes} />
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
              Elige un cliente para ver su plan, contenido, campañas y cobros.
            </p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
