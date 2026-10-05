import { Link } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { HeaderNav } from "./HeaderNav";
import { MobileNav } from "./MobileNav";
import { UserMenu } from "./UserMenu";
import type { UserProfile } from "./useUserProfile";

interface AppHeaderProps {
  path: string;
  user: User | null;
  profile: UserProfile | null;
  onSignOut: () => void;
  /** Buscador anclado al botón "Buscar" (HeaderSearch). */
  search: ReactNode;
  mobileNavOpen: boolean;
  onMobileNavOpenChange: (open: boolean) => void;
  /** Botón del panel del cliente en móvil. */
  clientTrigger: ReactNode;
}

/** Header de 56px: gestión transversal de la agencia. */
export function AppHeader({
  path,
  user,
  profile,
  onSignOut,
  search,
  mobileNavOpen,
  onMobileNavOpenChange,
  clientTrigger,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-sidebar/95 backdrop-blur">
      {/*
        Logo a la izquierda, nav al centro, acciones a la derecha. Hasta xl la nav se centra en el
        espacio libre (mx-auto); desde xl hay sitio para centrarla exactamente con 3 columnas.
      */}
      <div className="flex h-14 items-center gap-1.5 px-2 sm:gap-2 sm:px-3 md:px-4 lg:gap-4 lg:px-6 xl:grid xl:grid-cols-[1fr_auto_1fr]">
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <MobileNav path={path} open={mobileNavOpen} onOpenChange={onMobileNavOpenChange} />
          <Link
            to="/dashboard"
            aria-label="Vibranding, ir a Inicio"
            className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-brand text-lg tracking-tight text-gradient-brand bg-gradient-brand-animated md:text-2xl">
              Vibranding
            </span>
          </Link>
        </div>
        <HeaderNav path={path} />
        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0 md:gap-2 xl:justify-self-end">
          {search}
          {clientTrigger}
          <UserMenu user={user} profile={profile} onSignOut={onSignOut} />
        </div>
      </div>
    </header>
  );
}
