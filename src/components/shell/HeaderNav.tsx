import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { NavBadge } from "./NavBadge";
import { PRIMARY_NAV, isPathActive, type NavItem } from "./navConfig";

const linkClass = (active: boolean) =>
  cn(
    "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm lg:px-2.5 font-medium whitespace-nowrap transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
  );

function HeaderNavItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={linkClass(active)}
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {/* Bajo 1280px solo ícono, para que el buscador expandido no tape la navegación. */}
      <span className="sr-only xl:not-sr-only">{item.label}</span>
      <NavBadge to={item.to} />
    </Link>
  );
}

/** Navegación transversal de escritorio (desde md). En móvil vive en MobileNav. */
export function HeaderNav({ path }: { path: string }) {
  return (
    <nav aria-label="Navegación principal" className="hidden min-w-0 md:ml-4 md:block lg:ml-8">
      <ul className="flex items-center gap-0.5">
        {PRIMARY_NAV.map((item) => (
          <li key={item.to}>
            <HeaderNavItem item={item} active={isPathActive(path, item.to)} />
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
          const active = isPathActive(path, item.to);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(linkClass(active), "w-full px-3 py-2")}
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
