/**
 * Archivos del onboarding para la ficha del cliente (solo editores).
 * El bucket 'onboarding' es privado: se entrega una URL firmada de lectura
 * de corta duración, y solo para paths que el cliente envió en client_intake.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isClientFilePath } from "./schema";

/** Duración de la URL firmada de lectura. */
const READ_URL_TTL_SECONDS = 5 * 60;

const FileInput = z.object({
  clientId: z.string().uuid(),
  path: z.string().min(1).max(300),
});

export const getOnboardingFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; path: string }) => FileInput.parse(d))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, data.clientId);
    if (!isClientFilePath(data.clientId, data.path)) throw new Error("Archivo no válido");

    // Lectura con la sesión del usuario: el RLS de client_intake (can_edit_client) decide.
    const { data: intake, error } = await context.supabase
      .from("client_intake")
      .select("archivos")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (error) {
      console.error("[onboarding] no se pudo leer client_intake", data.clientId, error.message);
      throw new Error("No pudimos abrir el archivo. Intenta de nuevo.");
    }
    if (!intake?.archivos.includes(data.path))
      throw new Error("Ese archivo no está en el onboarding del cliente");

    // Service role solo para firmar la lectura (bucket privado).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("onboarding")
      .createSignedUrl(data.path, READ_URL_TTL_SECONDS, { download: true });
    if (signErr || !signed?.signedUrl) {
      console.error("[onboarding] no se pudo firmar la lectura", data.clientId, signErr?.message);
      throw new Error("No pudimos abrir el archivo. Puede que ya no exista.");
    }
    return { url: signed.signedUrl };
  });
