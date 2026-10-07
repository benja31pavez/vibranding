/**
 * Server functions del panel del cliente (/mi): Leads, WhatsApp e Instagram
 * (solo lectura). Mismo modelo que panel.functions.ts:
 *  - Sin `preview`: el cliente sale de user_client_id() dentro de las RPC.
 *  - Con `preview` (UUID): vista previa de la agencia, validada con
 *    getClientOrgRole en channels.server.ts y con owns_client en la BD.
 * La lógica vive en channels.server.ts (import dinámico: no llega al navegador).
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PanelResult } from "./model";
import type {
  ClientLead,
  InstagramOverview,
  Page,
  WhatsAppConversation,
  WhatsAppLine,
  WhatsAppMessage,
} from "./channelsModel";

/** Tope de páginas (las RPC también limitan el offset). */
const MAX_PAGE = 999;

const Preview = z.string().uuid().optional();
const PageInput = z.object({ preview: Preview, page: z.number().int().min(0).max(MAX_PAGE) });
const PreviewInput = z.object({ preview: Preview });
const MessagesInput = z.object({
  preview: Preview,
  conversationId: z.string().uuid(),
  cursor: z
    .object({ before: z.string().datetime({ offset: true }), beforeId: z.string().uuid() })
    .nullable(),
});

// Las RPC client_* aún no están en types.ts: cliente sin tipar.
const untyped = (db: unknown) => db as SupabaseClient;

export const getClientPanelLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { preview?: string; page: number }) => PageInput.parse(d))
  .handler(async ({ data, context }): Promise<PanelResult<Page<ClientLead>>> => {
    const { loadPanelLeads } = await import("./channels.server");
    return loadPanelLeads(untyped(context.supabase), context.userId, data.preview, data.page);
  });

export const getClientPanelWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { preview?: string; page: number }) => PageInput.parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      PanelResult<{ line: WhatsAppLine | null; conversations: Page<WhatsAppConversation> }>
    > => {
      const { loadPanelWhatsApp } = await import("./channels.server");
      return loadPanelWhatsApp(untyped(context.supabase), context.userId, data.preview, data.page);
    },
  );

export const getClientPanelMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      preview?: string;
      conversationId: string;
      cursor: { before: string; beforeId: string } | null;
    }) => MessagesInput.parse(d),
  )
  .handler(async ({ data, context }): Promise<PanelResult<WhatsAppMessage[]>> => {
    const { loadPanelMessages } = await import("./channels.server");
    return loadPanelMessages(
      untyped(context.supabase),
      context.userId,
      data.preview,
      data.conversationId,
      data.cursor,
    );
  });

export const getClientPanelInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { preview?: string }) => PreviewInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<PanelResult<InstagramOverview>> => {
    const { loadPanelInstagram } = await import("./channels.server");
    return loadPanelInstagram(untyped(context.supabase), context.userId, data.preview);
  });
