import {
  BarChart3,
  CalendarDays,
  DollarSign,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  Images,
  LineChart,
  Plug,
  Receipt,
  Target,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

/** Gestión transversal de la agencia (menú del header). */
export const PRIMARY_NAV: readonly NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/clients", label: "Clientes", icon: Users },
  {
    to: "/approvals",
    label: "Aprobaciones",
    icon: Inbox,
  },
  {
    to: "/agenda",
    label: "Agenda",
    icon: CalendarDays,
  },
  {
    to: "/pipeline",
    label: "Prospectos",
    icon: Target,
  },
  {
    to: "/billing",
    label: "Cobros",
    icon: Receipt,
  },
  { to: "/reports", label: "Reportes", icon: BarChart3 },
];

/** Configuración de la agencia (menú del avatar). */
export const SETTINGS_NAV: readonly NavItem[] = [
  {
    to: "/settings/pricing",
    label: "Precios",
    icon: DollarSign,
  },
  {
    to: "/settings/meta",
    label: "Meta",
    icon: Plug,
  },
  { to: "/portfolio", label: "Portafolio", icon: Images },
  { to: "/stats", label: "Estadísticas", icon: LineChart },
  { to: "/admin/health", label: "Salud", icon: HeartPulse },
];

/** Activo si la ruta coincide o es una subruta (Clientes activo dentro de /clients/...). */
export function isPathActive(path: string, to: string): boolean {
  return path === to || path.startsWith(`${to}/`);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? (parts[1][0] ?? "") : (parts[0][1] ?? "");
  return `${first}${second}`.toUpperCase();
}
