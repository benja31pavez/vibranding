import { supabase } from "@/integrations/supabase/client";

/**
 * Tipo de usuario del panel (navegador):
 *  - "client": usuario invitado de un cliente (client_users). Solo /portal.
 *  - "agency": cualquier otro usuario con sesión.
 *
 * Es un guard de interfaz: los datos los protegen RLS y las server functions.
 * Falla CERRADO: si no se puede verificar, lanza (nunca asume "agency").
 */
export type UserKind = "agency" | "client";

export class UserKindError extends Error {
  constructor() {
    super("No pudimos verificar tu tipo de cuenta. Revisa tu conexión e intenta de nuevo.");
    this.name = "UserKindError";
  }
}

// Una consulta por usuario y pestaña; los errores no se guardan (se reintenta).
const cache = new Map<string, Promise<UserKind>>();

export function resolveUserKind(userId: string): Promise<UserKind> {
  const cached = cache.get(userId);
  if (cached) return cached;
  const pending = (async (): Promise<UserKind> => {
    const { data, error } = await supabase.rpc("user_client_id");
    if (error) {
      console.error("[auth] No se pudo verificar el tipo de usuario", error);
      throw new UserKindError();
    }
    return data ? "client" : "agency";
  })();
  cache.set(userId, pending);
  pending.catch(() => cache.delete(userId));
  return pending;
}

/** Olvida el resultado (p. ej. para reintentar tras un error). */
export function forgetUserKind(userId: string): void {
  cache.delete(userId);
}
