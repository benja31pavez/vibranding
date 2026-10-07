import { useState } from "react";
import { ChevronUp, KeyRound, LogOut, UserCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SecuritySection } from "@/components/profile/SecuritySection";

interface ClientPanelUserMenuProps {
  email: string | null;
  onSignOut: () => void;
}

/** Menú mínimo del usuario cliente: cambiar contraseña y cerrar sesión. */
export function ClientPanelUserMenu({ email, onSignOut }: ClientPanelUserMenuProps) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const label = email ?? "Mi cuenta";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Mi cuenta (${label})`}
            className="flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <UserCircle2 aria-hidden className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <ChevronUp aria-hidden className="h-4 w-4 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="text-xs text-muted-foreground">Sesión iniciada</div>
            <div className="mt-0.5 truncate text-sm font-medium">{label}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {email && (
            <DropdownMenuItem onSelect={() => setPasswordOpen(true)} className="cursor-pointer">
              <KeyRound className="mr-2 h-4 w-4" /> Cambiar contraseña
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onSignOut} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {email && (
        <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cambiar contraseña</DialogTitle>
              <DialogDescription className="sr-only">
                Te enviamos un código a tu email para confirmar el cambio.
              </DialogDescription>
            </DialogHeader>
            <SecuritySection email={email} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
