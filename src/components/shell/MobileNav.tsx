import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { VerticalNavList } from "./HeaderNav";
import { PRIMARY_NAV, SETTINGS_NAV } from "./navConfig";

interface MobileNavProps {
  path: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Menú hamburguesa (bajo md) con la gestión transversal de la agencia. */
export function MobileNav({ path, open, onOpenChange }: MobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" aria-label="Abrir menú principal">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] max-w-[85vw] overflow-y-auto p-0">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle className="text-base">Menú</SheetTitle>
          <SheetDescription className="sr-only">Navegación principal de la agencia</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-3 py-4">
          <VerticalNavList items={PRIMARY_NAV} path={path} label="Navegación principal" />
          <div>
            <div className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Configuración
            </div>
            <VerticalNavList items={SETTINGS_NAV} path={path} label="Configuración" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
