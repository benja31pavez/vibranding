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
        Logo sobre el sidebar, nav desde donde termina el sidebar, acciones a la derecha: así el buscador tiene espacio para
        expandirse (~360px) sin tapar la navegación.
      */}
      <div className="flex h-14 items-center gap-1.5 px-2 sm:gap-2 sm:px-3 md:px-4 lg:gap-4 lg:px-6">
        {/*
          Desde md el bloque del logo mide lo justo para que la nav parta 8px después del borde
          del sidebar (w-60 = 240px): padding + ancho + gap = 248px (md: 16+224+8, lg: 24+208+16).
        */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:w-56 lg:w-52">
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
        <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
          {search}
          {clientTrigger}
          <UserMenu user={user} profile={profile} onSignOut={onSignOut} />
        </div>
      </div>
    </header>
  );
}
