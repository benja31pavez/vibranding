import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PortalShellProps {
  clientName?: string;
  onSignOut: () => void;
  children: ReactNode;
}

/** Marco del portal para el cliente: cabecera con la marca Vibranding y salida. */
export function PortalShell({ clientName, onSignOut, children }: PortalShellProps) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-sidebar/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 md:h-16 md:max-w-5xl md:px-6">
          <span className="font-brand text-2xl tracking-tight text-gradient-brand bg-gradient-brand-animated">
            Vibranding
          </span>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {clientName && (
              <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                {clientName}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              <LogOut aria-hidden className="mr-1 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 md:max-w-5xl md:px-6 md:py-8">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-muted-foreground md:max-w-5xl">
        ¿Dudas? Escríbele a tu equipo de Vibranding. Estamos para ayudarte.
      </footer>
    </div>
  );
}
