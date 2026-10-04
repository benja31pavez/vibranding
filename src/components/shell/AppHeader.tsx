import { Link } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { HeaderNav } from "./HeaderNav";
import { MobileNav } from "./MobileNav";
import { SearchButton } from "./SearchButton";
import { UserMenu } from "./UserMenu";
import type { UserProfile } from "./useUserProfile";

interface AppHeaderProps {
  path: string;
  user: User | null;
  profile: UserProfile | null;
  onSignOut: () => void;
  onOpenSearch: () => void;
  mobileNavOpen: boolean;
  onMobileNavOpenChange: (open: boolean) => void;
  /** Botón del panel del cliente en móvil. */
  clientTrigger: ReactNode;
}

/** Header de 56px: gestión transversal de la agencia. */
export function AppHeader({
  path, user, profile, onSignOut, onOpenSearch, mobileNavOpen, onMobileNavOpenChange, clientTrigger,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-sidebar/95 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-3 md:px-4 lg:gap-4 lg:px-6">
        <MobileNav path={path} open={mobileNavOpen} onOpenChange={onMobileNavOpenChange} />
        <Link
          to="/dashboard"
          aria-label="Vibranding, ir a Inicio"
          className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-brand text-xl tracking-tight text-gradient-brand bg-gradient-brand-animated md:text-2xl">
            Vibranding
          </span>
        </Link>
        <HeaderNav path={path} />
        <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
          <SearchButton onClick={onOpenSearch} />
          {clientTrigger}
          <UserMenu user={user} profile={profile} onSignOut={onSignOut} />
        </div>
      </div>
    </header>
  );
}
