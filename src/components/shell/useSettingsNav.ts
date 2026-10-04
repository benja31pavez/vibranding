import { useIsPlatformAdmin } from "@/lib/auth/platformAdmin.functions";
import { SETTINGS_NAV, type NavItem } from "./navConfig";

/** Rutas de configuración que solo ven los administradores de la plataforma. */
const PLATFORM_ADMIN_ROUTES: ReadonlySet<string> = new Set(["/admin/health"]);

/**
 * SETTINGS_NAV sin las entradas de administración para quien no es admin de
 * plataforma (mientras se consulta, también se ocultan). La ruta sigue
 * protegida en el servidor; esto solo evita mostrar un enlace inútil.
 */
export function useSettingsNav(): readonly NavItem[] {
  const admin = useIsPlatformAdmin();
  if (admin.data === true) return SETTINGS_NAV;
  return SETTINGS_NAV.filter((item) => !PLATFORM_ADMIN_ROUTES.has(item.to));
}
