/**
 * Server functions del panel del cliente (/mi) — Fase 2 (solo lectura).
 *
 * - Sin `preview`: el cliente sale de user_client_id() dentro de las RPC
 *   client_* (nunca de la URL ni del input).
 * - Con `preview` (UUID): vista previa de la agencia ("Ver como cliente").
 *   Se exige rol en la org dueña de ese cliente (getClientOrgRole, en
 *   panel.server.ts) y la RPC vuelve a exigir owns_client. Un usuario cliente
 *   que lo envíe no obtiene otro cliente: no es miembro de ninguna org.
 *
 * La lógica vive en panel.server.ts (import dinámico: no llega al navegador).
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PanelContract, PanelFiles, PanelPlan, PanelResult } from "./model";

const PreviewInput = z.object({ preview: z.string().uuid().optional() });
const PreviewRequired = z.object({ preview: z.string().uuid() });

type PreviewData = { preview?: string };

// Las RPC client_* aún no están en types.ts: cliente sin tipar.
const untyped = (db: unknown) => db as SupabaseClient;

export interface PanelPreviewBrand {
  id: string;
  name: string;
  instagramHandle: string | null;
  logoUrl: string | null;
}

/** Marca del cliente para la vista previa de la agencia (valida el rol en servidor). */
export const getPanelPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { preview: string }) => PreviewRequired.parse(d))
  .handler(async ({ data, context }): Promise<PanelPreviewBrand> => {
    const { loadPreviewBrand } = await import("./panel.server");
    return loadPreviewBrand(context.userId, data.preview);
  });

export const getClientPanelPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: PreviewData) => PreviewInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<PanelResult<PanelPlan>> => {
    const { loadPanelPlan } = await import("./panel.server");
    return loadPanelPlan(untyped(context.supabase), context.userId, data.preview);
  });

export const getClientPanelFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: PreviewData) => PreviewInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<PanelResult<PanelFiles>> => {
    const { loadPanelFiles } = await import("./panel.server");
    return loadPanelFiles(untyped(context.supabase), context.userId, data.preview);
  });

export const getClientPanelContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: PreviewData) => PreviewInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<PanelResult<PanelContract[]>> => {
    const { loadPanelContracts } = await import("./panel.server");
    return loadPanelContracts(untyped(context.supabase), context.userId, data.preview);
  });
