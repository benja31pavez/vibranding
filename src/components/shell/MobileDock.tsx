import { Link } from "@tanstack/react-router";
import { Calendar, CheckCheck, CreditCard, LayoutDashboard, Users } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { NavBadge } from "./NavBadge";
import type { ClientSummary } from "./useClientList";

interface DockItem {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  to: string;
  params?: Record<string, string>;
  /** Para el badge y el estado activo, el prefijo de ruta que representa. */
  match: string;
  badgeTo?: string;
}

interface MobileDockProps {
  path: string;
  activeClient: ClientSummary | null;
}

/**
 * Barra inferior fija del panel en teléfono (bajo md): Panel del cliente activo,
 * Clientes, Aprobaciones, Agenda y Cobros. Reemplaza la navegación de texto que en
 * escritorio vive como iconos en la cabecera.
 */
export function MobileDock({ path, activeClient }: MobileDockProps) {
  const items: DockItem[] = [
    activeClient
      ? {
          key: "panel",
          label: "Panel",
          icon: LayoutDashboard,
          to: "/clients/$clientId",
          params: { clientId: activeClient.id },
          match: `/clients/${activeClient.id}`,
        }
      : {
          key: "panel",
          label: "Inicio",
          icon: LayoutDashboard,
          to: "/dashboard",
          match: "/dashboard",
        },
    { key: "clientes", label: "Clientes", icon: Users, to: "/clients", match: "/clients" },
    {
      key: "aprobaciones",
      label: "Aprobaciones",
      icon: CheckCheck,
      to: "/approvals",
      match: "/approvals",
      badgeTo: "/approvals",
    },
    { key: "agenda", label: "Agenda", icon: Calendar, to: "/agenda", match: "/agenda" },
    {
      key: "cobros",
      label: "Cobros",
      icon: CreditCard,
      to: "/billing",
      match: "/billing",
      badgeTo: "/billing",
    },
  ];

  const isActive = (item: DockItem) => {
    if (item.key === "clientes") {
      // "Clientes" solo en la lista; dentro de un cliente manda "Panel".
      return path === "/clients" || path === "/clients/" || path.startsWith("/clients/connect");
    }
    return (
      path === item.match || path.startsWith(`${item.match}/`) || path.startsWith(`${item.match}?`)
    );
  };

  return (
    <nav
      aria-label="Navegación principal"
      className="mobile-dock fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-background/95 backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                to={item.to}
                params={item.params}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-[10.5px] font-semibold",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active ? "text-[#2F6BFF]" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.badgeTo && <NavBadge to={item.badgeTo} />}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
