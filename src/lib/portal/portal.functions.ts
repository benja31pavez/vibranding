/**
 * Server functions del portal del cliente v2.
 *
 * - Sin `previewClientId`: el usuario debe ser un usuario invitado del portal
 *   (user_client_id() no nulo). Ve y decide sobre SU cliente.
 * - Con `previewClientId`: vista previa para el equipo. Exige ser miembro de la
 *   org del cliente y es solo lectura (decidir está bloqueado).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  NOTE_MAX_LENGTH,
  NOTE_MIN_LENGTH,
  isMonth,
  type DecisionResult,
  type PortalCalendar,
  type PortalSnapshotResult,
} from "./model";
import type { Db, PortalAccess } from "./portal.server";

const PreviewInput = z.object({ previewClientId: z.string().uuid().optional() });

const CalendarInput = PreviewInput.extend({
  month: z.string().refine(isMonth, "Mes inválido (YYYY-MM-01)"),
});

const DecisionInput = z
  .object({
    kind: z.enum(["deliverable", "post"]),
    id: z.string().uuid(),
    decision: z.enum(["approve", "changes"]),
    note: z
      .string()
      .max(NOTE_MAX_LENGTH, `La nota puede tener hasta ${NOTE_MAX_LENGTH} caracteres`)
      .default(""),
  })
  .refine((d) => d.decision === "approve" || d.note.trim().length >= NOTE_MIN_LENGTH, {
    message: "Cuéntanos qué cambios necesitas",
    path: ["note"],
  });

const NOT_PORTAL_USER = "Esta acción es solo para clientes con acceso al portal.";

/** Resuelve el modo y el cliente. Devuelve null si el usuario no tiene cliente asignado. */
async function resolveAccess(
  db: Db,
  userId: string,
  previewClientId: string | undefined,
): Promise<PortalAccess | null> {
  if (previewClientId) {
    const { getClientOrgRole, ClientAccessError } = await import("@/lib/auth/clientAccess.server");
    const role = await getClientOrgRole(userId, previewClientId);
    if (!role) throw new ClientAccessError("No tienes acceso a este cliente");
    return { mode: "preview", clientId: previewClientId, db };
  }
  const { resolvePortalClientId } = await import("./portal.server");
  const clientId = await resolvePortalClientId(db);
  return clientId ? { mode: "client", clientId, db } : null;
}

export const getPortalSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { previewClientId?: string }) => PreviewInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<PortalSnapshotResult> => {
    const access = await resolveAccess(context.supabase, context.userId, data.previewClientId);
    if (!access) return { status: "no_client" };
    const { loadPortalSnapshot } = await import("./portal.server");
    return { status: "ok", snapshot: await loadPortalSnapshot(access) };
  });

export const getPortalCalendar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { month: string; previewClientId?: string }) => CalendarInput.parse(d))
  .handler(async ({ data, context }): Promise<PortalCalendar | null> => {
    const access = await resolveAccess(context.supabase, context.userId, data.previewClientId);
    if (!access) return null;
    const { loadPortalCalendar } = await import("./portal.server");
    try {
      return await loadPortalCalendar(access, data.month);
    } catch (e) {
      console.error("[portal] calendario falló", {
        clientId: access.clientId,
        error: e instanceof Error ? e.message : e,
      });
      throw new Error("No pudimos cargar el calendario. Intenta de nuevo en un momento.");
    }
  });

function authorName(claims: Record<string, unknown>): string {
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const email = typeof claims.email === "string" ? claims.email : "";
  return (name || email || "Cliente").slice(0, 120);
}

/** Aprobar / pedir cambios desde el portal. Solo el usuario invitado del cliente. */
export const decidePortalItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      kind: "deliverable" | "post";
      id: string;
      decision: "approve" | "changes";
      note?: string;
    }) => DecisionInput.parse(d),
  )
  .handler(async ({ data, context }): Promise<DecisionResult> => {
    const access = await resolveAccess(context.supabase, context.userId, undefined);
    if (!access) throw new Error(NOT_PORTAL_USER);
    const server = await import("./portal.server");
    try {
      return await server.decidePortalItem(
        access,
        { userId: context.userId, name: authorName(context.claims as Record<string, unknown>) },
        data,
      );
    } catch (e) {
      console.error("[portal] decisión falló", {
        clientId: access.clientId,
        kind: data.kind,
        id: data.id,
        error: e instanceof Error ? e.message : e,
      });
      throw new Error("No pudimos guardar tu respuesta. Intenta de nuevo en un momento.");
    }
  });
