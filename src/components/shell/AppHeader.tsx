import { Link } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { useIsPlatformAdmin } from "@/lib/auth/platformAdmin.functions";
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

/** Primer nombre para el saludo ("Hola, Benjamín"). */
function firstNameOf(user: User | null, profile: UserProfile | null): string | null {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const full =
    profile?.full_name ||
    [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.length > 0) ||
    null;
  if (!full) return null;
  return full.trim().split(/\s+/)[0] ?? null;
}

/**
 * Cabecera de 56px con degradado de marca: marca a la izquierda, saludo, navegación
 * transversal de la agencia como iconos y, a la derecha, buscador, cliente (móvil) y cuenta.
 */
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
  const admin = useIsPlatformAdmin();
  const firstName = firstNameOf(user, profile);
  return (
    <header className="shell-header-brand sticky top-0 z-30 border-b border-white/10">
      <div className="flex h-14 items-center gap-1.5 px-2 sm:gap-2 sm:px-3 md:px-4 lg:gap-4 lg:px-6">
        {/*
          Desde md el bloque de la marca mide lo justo para que la nav parta 8px después del borde
          del sidebar (w-60 = 240px): padding + ancho + gap = 248px (md: 16+224+8, lg: 24+208+16).
        */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:w-56 lg:w-52">
          <MobileNav path={path} open={mobileNavOpen} onOpenChange={onMobileNavOpenChange} />
          <Link
            to="/dashboard"
            aria-label="Vibranding, ir a Inicio"
            className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span
              aria-hidden="true"
              className="hidden h-7 w-7 rounded-lg border border-white/35 bg-white/20 md:block"
            />
            <span className="font-brand text-lg tracking-tight text-white md:text-2xl">
              Vibranding
            </span>
          </Link>
        </div>

        {firstName && (
          <div className="hidden shrink-0 items-center gap-2 text-sm text-white/90 lg:flex">
            <span>Hola, {firstName}</span>
            {admin.data === true && (
              <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Admin
              </span>
            )}
          </div>
        )}

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
