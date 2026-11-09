import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { NavBadge } from "./NavBadge";
import { PRIMARY_NAV, isPrimaryNavActive, type NavItem } from "./navConfig";

const linkClass = (active: boolean) =>
  cn(
    "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium 2xl:px-2.5 whitespace-nowrap transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-sidebar-accent bg-brand-soft text-sidebar-accent-foreground [&>svg]:text-brand-1"
      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
  );

/** Variante para la cabecera con degradado: iconos blancos, activo con fondo translúcido. */
const headerLinkClass = (active: boolean) =>
  cn(
    "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
    active
      ? "bg-white/22 text-white shadow-inner"
      : "text-white/85 hover:bg-white/15 hover:text-white",
  );

function HeaderNavItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={headerLinkClass(active)}
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      {/* Solo ícono (como en Nexus): el nombre va en el tooltip nativo y para lectores de pantalla. */}
      <span className="sr-only">{item.label}</span>
      <NavBadge to={item.to} />
    </Link>
  );
}

/** Navegación transversal de escritorio (desde md). En móvil vive en MobileNav. */
export function HeaderNav({ path }: { path: string }) {
  return (
    <nav aria-label="Navegación principal" className="hidden min-w-0 md:block">
      <ul className="flex items-center gap-0.5 rounded-lg">
        {PRIMARY_NAV.map((item) => (
          <li key={item.to}>
            <HeaderNavItem item={item} active={isPrimaryNavActive(path, item.to)} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Lista vertical reutilizada en el Sheet móvil. */
export function VerticalNavList({
  items,
  path,
  label,
}: {
  items: readonly NavItem[];
  path: string;
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = isPrimaryNavActive(path, item.to);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(linkClass(active), "relative w-full px-3 py-2")}
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
                <NavBadge to={item.to} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
