import {
  BarChart3, CalendarCheck, CalendarDays, DollarSign, HeartPulse, Inbox, LayoutDashboard,
  Images, LineChart, Plug, Receipt, Users,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Palabras extra para la búsqueda de la paleta de comandos. */
  keywords?: string[];
}

/** Gestión transversal de la agencia (menú del header). */
export const PRIMARY_NAV: readonly NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard, keywords: ["dashboard", "hoy"] },
  { to: "/clients", label: "Clientes", icon: Users, keywords: ["cuentas", "marcas"] },
  { to: "/approvals", label: "Aprobaciones", icon: Inbox, keywords: ["bandeja", "revisión", "pendientes"] },
  { to: "/calendar", label: "Calendario", icon: CalendarDays, keywords: ["agenda", "publicaciones"] },
  { to: "/bookings", label: "Reservas", icon: CalendarCheck, keywords: ["citas", "reuniones"] },
  { to: "/billing", label: "Cobros", icon: Receipt, keywords: ["pagos", "facturación", "flow", "mrr"] },
  { to: "/reports", label: "Reportes", icon: BarChart3, keywords: ["informes", "resultados"] },
];

/** Configuración de la agencia (menú del avatar). */
export const SETTINGS_NAV: readonly NavItem[] = [
  { to: "/settings/pricing", label: "Precios", icon: DollarSign, keywords: ["planes", "servicios"] },
  { to: "/settings/meta", label: "Meta", icon: Plug, keywords: ["facebook", "instagram", "conexión"] },
  { to: "/portfolio", label: "Portafolio", icon: Images, keywords: ["trabajos", "público"] },
  { to: "/stats", label: "Estadísticas", icon: LineChart, keywords: ["landing", "visitas"] },
  { to: "/admin/health", label: "Salud", icon: HeartPulse, keywords: ["estado", "diagnóstico"] },
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
