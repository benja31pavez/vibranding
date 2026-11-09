import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ClientAvatar } from "./ClientAvatar";
import { ClientSidebar } from "./ClientSidebar";
import type { ClientSummary } from "./useClientList";

interface MobileClientSheetProps {
  activeClient: ClientSummary | null;
  path: string;
  staleOutcomes: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Bajo md, el panel del cliente se abre como Sheet desde el header. */
export function MobileClientSheet({ open, onOpenChange, ...sidebar }: MobileClientSheetProps) {
  const { activeClient } = sidebar;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hdr-ctl h-9 w-9 md:hidden"
          aria-label={
            activeClient ? `Abrir panel de ${activeClient.name}` : "Abrir panel del cliente"
          }
        >
          {activeClient ? (
            <ClientAvatar
              clientId={activeClient.id}
              name={activeClient.name}
              className="h-7 w-7 text-[11px]"
            />
          ) : (
            <PanelLeft className="h-5 w-5" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="shell-sidebar-indigo flex w-[280px] max-w-[85vw] flex-col border-0 p-0 text-white [&>button]:text-white"
      >
        <SheetHeader className="border-b px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base">Cliente</SheetTitle>
          <SheetDescription className="sr-only">Secciones del cliente activo</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <ClientSidebar {...sidebar} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
