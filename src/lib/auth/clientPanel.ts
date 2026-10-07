import { supabase } from "@/integrations/supabase/client";
import { forgetUserKind, resolveUserKind } from "./userKind";

/**
 * Panel del cliente (/mi) — activación controlada (Fase 1 de plan-acceso-clientes.md).
 *
 * El portal (/portal) sigue siendo el destino por defecto del usuario cliente.
 * Solo si su fila de client_users tiene `panel_enabled = true` entra al panel.
 * Es un guard de interfaz: los datos los protegen RLS, client_self y las
 * server functions del portal (que derivan el cliente de user_client_id()).
 */
export const CLIENT_PANEL_HOME = "/mi";
export const CLIENT_PORTAL_HOME = "/portal";
export const AGENCY_HOME = "/dashboard";

export type ClientHome = typeof CLIENT_PANEL_HOME | typeof CLIENT_PORTAL_HOME;

export class ClientPanelError extends Error {
  constructor() {
    super("No pudimos verificar tu acceso. Revisa tu conexión e intenta de nuevo.");
    this.name = "ClientPanelError";
  }
}

/** Antes de aplicar la migración la columna no existe: equivale a "apagado". */
function isMissingColumn(error: { code?: string }): boolean {
  return error.code === "42703" || error.code === "PGRST204";
}

// Una consulta por usuario y pestaña; los errores no se guardan (se reintenta).
const cache = new Map<string, Promise<boolean>>();

/** ¿Este usuario cliente tiene activado el panel nuevo? Lanza si no se puede verificar. */
export function resolveClientPanelEnabled(userId: string): Promise<boolean> {
  const cached = cache.get(userId);
  if (cached) return cached;
  const pending = (async (): Promise<boolean> => {
    const { data, error } = await supabase
      .from("client_users")
      .select("panel_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      if (isMissingColumn(error)) return false;
      console.error("[auth] No se pudo leer panel_enabled", error);
      throw new ClientPanelError();
    }
    return data?.panel_enabled === true;
  })();
  cache.set(userId, pending);
  pending.catch(() => cache.delete(userId));
  return pending;
}

export function forgetClientPanel(userId: string): void {
  cache.delete(userId);
}

/** Al cerrar sesión: olvida el tipo de usuario y el interruptor del panel. */
export function forgetClientAccess(userId: string | null | undefined): void {
  if (!userId) return;
  forgetUserKind(userId);
  forgetClientPanel(userId);
}

/**
 * Destino de un usuario YA confirmado como cliente. Si no se puede leer el
 * interruptor, va al portal (también es solo del cliente): nunca a la agencia.
 */
export async function clientHomeFor(userId: string): Promise<ClientHome> {
  try {
    return (await resolveClientPanelEnabled(userId)) ? CLIENT_PANEL_HOME : CLIENT_PORTAL_HOME;
  } catch {
    return CLIENT_PORTAL_HOME;
  }
}

/** Resultado del guard del panel del cliente. */
type ShellRedirect = typeof AGENCY_HOME | typeof CLIENT_PORTAL_HOME;
export type ClientShellAccess = { kind: "allowed" } | { kind: "redirect"; to: ShellRedirect };

/**
 * Guard del panel del cliente. Falla CERRADO: si algo no se puede verificar,
 * lanza (UserKindError / ClientPanelError) y el layout muestra "Reintentar".
 *  - agencia → /dashboard (la agencia usa "Vista previa del portal").
 *  - cliente sin el panel activado → /portal.
 *  - cliente con el panel activado → permitido.
 */
export async function resolveClientShellAccess(userId: string): Promise<ClientShellAccess> {
  const kind = await resolveUserKind(userId);
  if (kind !== "client") return { kind: "redirect", to: AGENCY_HOME };
  const enabled = await resolveClientPanelEnabled(userId);
  return enabled ? { kind: "allowed" } : { kind: "redirect", to: CLIENT_PORTAL_HOME };
}
