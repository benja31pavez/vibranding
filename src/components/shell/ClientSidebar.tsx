import { Link } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { AutomationsStatusFooter } from "@/components/automations/automations-status";
import { ClientSidebarNav } from "@/components/clients/ClientSidebarNav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClientSwitcher } from "./ClientSwitcher";
import type { ClientSummary } from "./useClientList";

interface ClientSidebarProps {
  activeClient: ClientSummary | null;
  path: string;
  staleOutcomes: number;
}

/** Contenido del panel izquierdo (gestión de UN cliente). Se usa en el aside y en el Sheet móvil. */
export function ClientSidebar({ activeClient, path, staleOutcomes }: ClientSidebarProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-3 pb-2 pt-3">
          <ClientSwitcher activeClient={activeClient} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {activeClient ? (
            <ClientSidebarNav
              clientId={activeClient.id}
              path={path}
              staleOutcomes={staleOutcomes}
            />
          ) : (
            <p className="sb-muted rounded-lg border border-dashed border-white/20 px-3 py-3 text-sm">
              Elige un cliente para ver sus proyectos, contenido, campañas y cobros.
            </p>
          )}
        </div>
        <div className="space-y-0.5 px-3 pb-3 pt-2">
          <AutomationsStatusFooter />
          <Link
            to="/faq"
            className="sb-muted flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fb2ff]"
          >
            <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Preguntas frecuentes
          </Link>
        </div>
      </div>
    </TooltipProvider>
  );
}
