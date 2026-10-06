/**
 * Server functions de "Archivos": listar (con URLs firmadas), preparar una
 * subida directa a Storage, registrarla y eliminar. La lógica y la
 * autorización están en clientFiles.server.ts (y otra vez en la BD).
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ClientFilesList } from "./clientFiles.server";
import { CLIENT_FILE_ERRORS, CLIENT_FILE_TYPES, MAX_CLIENT_FILE_BYTES } from "./clientFiles";

const HOUR = 60 * 60 * 1000;
/** Subidas preparadas por usuario y hora (los objetos sin registrar se barren a las 48 h). */
const UPLOADS_PER_HOUR = 60;
const RATE_LIMITED = "Demasiadas subidas seguidas. Espera un rato y vuelve a intentarlo.";

let uploadLimiter: import("@/lib/security/ipRateLimit.server").RateLimiter | undefined;

async function allowUpload(userId: string): Promise<boolean> {
  const { createRateLimiter } = await import("@/lib/security/ipRateLimit.server");
  uploadLimiter ??= createRateLimiter(UPLOADS_PER_HOUR, HOUR);
  return uploadLimiter.allow(`client-files:${userId}`);
}

const ClientInput = z.object({ clientId: z.string().uuid() });

const SlotInput = z.object({
  clientId: z.string().uuid(),
  mime: z.string().refine((m) => m in CLIENT_FILE_TYPES, CLIENT_FILE_ERRORS.badType),
  size: z
    .number()
    .int()
    .positive(CLIENT_FILE_ERRORS.empty)
    .max(MAX_CLIENT_FILE_BYTES, CLIENT_FILE_ERRORS.tooBig),
});

const ConfirmInput = z.object({
  clientId: z.string().uuid(),
  path: z.string().min(1).max(200),
  name: z.string().max(500),
});

const DeleteInput = z.object({ clientId: z.string().uuid(), fileId: z.string().uuid() });

// El cliente de la sesión (tipado con el esquema generado) se usa sin tipos:
// client_files y sus RPC aún no están en types.ts.
const untyped = (db: unknown) => db as SupabaseClient;

export const listClientFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string }) => ClientInput.parse(d))
  .handler(async ({ data, context }): Promise<ClientFilesList> => {
    const { listClientFiles: list } = await import("./clientFiles.server");
    return list(context.userId, untyped(context.supabase), data.clientId);
  });

export const createClientFileUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof SlotInput>) => SlotInput.parse(d))
  .handler(async ({ data, context }): Promise<{ path: string; token: string }> => {
    if (!(await allowUpload(context.userId))) throw new Error(RATE_LIMITED);
    const { createUploadSlot } = await import("./clientFiles.server");
    return createUploadSlot(context.userId, untyped(context.supabase), data);
  });

export const confirmClientFileUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof ConfirmInput>) => ConfirmInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { confirmUpload } = await import("./clientFiles.server");
    return confirmUpload(context.userId, untyped(context.supabase), data);
  });

export const deleteClientFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof DeleteInput>) => DeleteInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { deleteFile } = await import("./clientFiles.server");
    await deleteFile(context.userId, untyped(context.supabase), data);
    return { ok: true };
  });
