import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamContact } from "@/components/proposals/public/TeamContact";
import { ClientLogo } from "@/components/clients/logo";

interface PortalShellProps {
  clientName?: string;
  /** Para mostrar el logo de la marca junto a su nombre (si tiene). */
  clientId?: string;
  onSignOut: () => void;
  children: ReactNode;
}

/** Marco del portal para el cliente: cabecera con la marca Vibranding y salida. */
export function PortalShell({ clientName, clientId, onSignOut, children }: PortalShellProps) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-sidebar/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 md:h-16 md:max-w-5xl md:px-6">
          <span className="font-brand text-2xl tracking-tight text-gradient-brand bg-gradient-brand-animated">
            Vibranding
          </span>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {clientName && (
              <span className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground sm:flex">
                <ClientLogo
                  clientId={clientId}
                  name={clientName}
                  hideFallback
                  className="h-6 w-6"
                />
                <span className="truncate">{clientName}</span>
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              <LogOut aria-hidden className="mr-1 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 md:max-w-5xl md:px-6 md:py-8">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 md:max-w-5xl md:px-6">
        <TeamContact
          title="Tu equipo en Vibranding"
          whatsappMessage={
            clientName
              ? `Hola, soy de ${clientName} y tengo una consulta: `
              : "Hola, tengo una consulta sobre mi marca: "
          }
        />
      </footer>
    </div>
  );
}
