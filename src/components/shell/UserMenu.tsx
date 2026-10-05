import { Link } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { ExternalLink, LogOut, UserCircle2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettingsNav } from "./useSettingsNav";
import type { UserProfile } from "./useUserProfile";

interface UserMenuProps {
  user: User | null;
  profile: UserProfile | null;
  onSignOut: () => void;
}

function displayNameOf(user: User | null, profile: UserProfile | null): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fromMeta = [meta.full_name, meta.name, meta.display_name].find(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  return profile?.full_name || fromMeta || user?.email || "Mi cuenta";
}

/** Menú del avatar: perfil, configuración de la agencia y cierre de sesión. */
export function UserMenu({ user, profile, onSignOut }: UserMenuProps) {
  const name = displayNameOf(user, profile);
  const settingsNav = useSettingsNav();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full"
          aria-label={`Cuenta y configuración (${name})`}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <UserCircle2 className="h-5 w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="text-xs text-muted-foreground">Sesión iniciada</div>
          <div className="mt-0.5 truncate text-sm font-medium">{name}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/profile">
            <UserCog className="mr-2 h-4 w-4" /> Editar perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" /> Ver sitio público
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Configuración
          </DropdownMenuLabel>
          {settingsNav.map((item) => (
            <DropdownMenuItem key={item.to} asChild className="cursor-pointer">
              <Link to={item.to}>
                <item.icon className="mr-2 h-4 w-4" /> {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
