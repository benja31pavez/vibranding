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
import type { Json } from "@/integrations/supabase/types";
import type { PanelContract, PanelFiles, PanelPlan, PanelResult } from "./model";

/** JSON de una RPC (se valida en el navegador con siteModel / adsModel). */
type PanelJson = Json;

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

const AdsInput = z.object({
  preview: z.string().uuid().optional(),
  platform: z.enum(["meta", "google"]),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
});

/** Sitio: multienlace y landing publicados + visitas/clics agregados (30 días). */
export const getClientPanelSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: PreviewData) => PreviewInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<PanelResult<PanelJson>> => {
    const { loadPanelSite } = await import("./panel.server");
    return (await loadPanelSite(
      untyped(context.supabase),
      context.userId,
      data.preview,
    )) as PanelResult<PanelJson>;
  });

/** Meta Ads / Google Ads: resumen del período, campañas y estado del pago de pauta. */
export const getClientPanelAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { preview?: string; platform: "meta" | "google"; days: 7 | 30 | 90 }) =>
    AdsInput.parse(d),
  )
  .handler(async ({ data, context }): Promise<PanelResult<PanelJson>> => {
    const { loadPanelAds } = await import("./panel.server");
    return (await loadPanelAds(
      untyped(context.supabase),
      context.userId,
      data.platform,
      data.days,
      data.preview,
    )) as PanelResult<PanelJson>;
  });
