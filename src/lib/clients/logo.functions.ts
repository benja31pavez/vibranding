import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LOGO_ERRORS, LOGO_MAX_BYTES, LOGO_TYPES } from "@/lib/clients/logo";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
/** Largo máximo del base64 de una imagen de 2 MB. */
const MAX_BASE64_LENGTH = Math.ceil(LOGO_MAX_BYTES / 3) * 4;

type RefreshMode = "button" | "reset" | "auto";

function clientIdOf(input: unknown): string {
  const clientId = (input as { clientId?: unknown } | null)?.clientId;
  if (typeof clientId !== "string" || !UUID_RE.test(clientId)) throw new Error("Cliente inválido");
  return clientId;
}

function validateRefresh(input: unknown): { clientId: string; mode: RefreshMode } {
  const mode = (input as { mode?: unknown } | null)?.mode;
  if (mode !== "button" && mode !== "reset" && mode !== "auto") {
    throw new Error("Modo inválido");
  }
  return { clientId: clientIdOf(input), mode };
}

function validateUpload(input: unknown): {
  clientId: string;
  contentType: string;
  dataBase64: string;
} {
  const raw = input as { contentType?: unknown; dataBase64?: unknown } | null;
  const contentType = raw?.contentType;
  const dataBase64 = raw?.dataBase64;
  if (typeof contentType !== "string" || !(LOGO_TYPES as readonly string[]).includes(contentType)) {
    throw new Error(LOGO_ERRORS.badType);
  }
  if (typeof dataBase64 !== "string" || dataBase64.length === 0) throw new Error(LOGO_ERRORS.empty);
  if (dataBase64.length > MAX_BASE64_LENGTH) throw new Error(LOGO_ERRORS.tooBig);
  if (!BASE64_RE.test(dataBase64)) throw new Error(LOGO_ERRORS.badType);
  return { clientId: clientIdOf(input), contentType, dataBase64 };
}

/**
 * Logo desde la foto de perfil de Instagram. Usa el token de Meta de la
 * agencia: solo editores. mode "auto" (al cambiar el @) y "button" no pisan un
 * logo manual; "reset" ("Volver a usar Instagram") sí.
 */
export const refreshClientLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateRefresh)
  .handler(async ({ data, context }) => {
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, data.clientId);
    const { refreshLogoFromInstagram } = await import("@/lib/clients/logo.server");
    return await refreshLogoFromInstagram(data.clientId, data.mode);
  });

/** "Subir logo": JPG, PNG o WebP de hasta 2 MB. Queda como logo manual. */
export const uploadClientLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateUpload)
  .handler(async ({ data, context }) => {
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, data.clientId);
    const bytes = Uint8Array.from(atob(data.dataBase64), (c) => c.charCodeAt(0));
    const { saveManualLogo } = await import("@/lib/clients/logo.server");
    return await saveManualLogo(data.clientId, bytes, data.contentType);
  });
