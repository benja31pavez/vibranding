/**
 * Leads, WhatsApp e Instagram del panel del cliente (/mi) — solo servidor.
 *
 * Igual que panel.server.ts: las RPC client_* fijan el cliente en la BD con
 * client_panel_target(_preview) (usuario cliente → user_client_id(); agencia →
 * _preview solo si owns_client). Antes de mandar `_preview` se exige rol en la
 * org de ese cliente (assertPreviewAccess → getClientOrgRole). Las RPC van con
 * la SESIÓN del usuario; service_role solo firma rutas de client-media que
 * pertenecen al cliente que devolvió la RPC.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PanelResult } from "./model";
import {
  CLIENT_MEDIA_BUCKET,
  MISSING_FN_CODES,
  PanelPreviewDenied,
  assertPreviewAccess,
  makeResolver,
  signPaths,
} from "./panel.server";
import { clientMediaPath } from "./model";
import {
  CONVERSATIONS_PAGE_SIZE,
  LEADS_PAGE_SIZE,
  MESSAGES_PAGE_SIZE,
  parseConversations,
  parseInstagramOverview,
  parseLeadsPage,
  parseMessages,
  parseWhatsAppLine,
  type ClientLead,
  type InstagramOverview,
  type Page,
  type WhatsAppConversation,
  type WhatsAppLine,
  type WhatsAppMessage,
} from "./channelsModel";

type Db = SupabaseClient;

type ChannelRpc =
  | "client_leads_page"
  | "client_whatsapp_status"
  | "client_whatsapp_conversations"
  | "client_whatsapp_messages"
  | "client_instagram_overview";

const LOAD_ERROR = "No pudimos cargar esta sección. Intenta de nuevo en un momento.";

/** `undefined` = la RPC no existe (migración sin aplicar). */
async function callChannelRpc(
  db: Db,
  userId: string,
  fn: ChannelRpc,
  args: Record<string, unknown>,
  preview: string | undefined,
): Promise<unknown> {
  if (preview) await assertPreviewAccess(userId, preview);
  const { data, error } = await db.rpc(fn, preview ? { ...args, _preview: preview } : args);
  if (error) {
    if (MISSING_FN_CODES.has(error.code ?? "")) return undefined;
    console.error(`[client-panel] ${fn} falló`, { userId, preview, code: error.code });
    throw new Error(LOAD_ERROR);
  }
  return data ?? null;
}

const ok = <T>(data: T): PanelResult<T> => ({ status: "ok", data });
const UNAVAILABLE = { status: "unavailable" } as const;

// ── Leads ───────────────────────────────────────────────────────────────────

export async function loadPanelLeads(
  db: Db,
  userId: string,
  preview: string | undefined,
  page: number,
): Promise<PanelResult<Page<ClientLead>>> {
  const raw = await callChannelRpc(
    db,
    userId,
    "client_leads_page",
    { _limit: LEADS_PAGE_SIZE, _offset: page * LEADS_PAGE_SIZE },
    preview,
  );
  return raw === undefined ? UNAVAILABLE : ok(parseLeadsPage(raw));
}

// ── WhatsApp ────────────────────────────────────────────────────────────────

export interface PanelWhatsApp {
  line: WhatsAppLine | null;
  conversations: Page<WhatsAppConversation>;
}

export async function loadPanelWhatsApp(
  db: Db,
  userId: string,
  preview: string | undefined,
  page: number,
): Promise<PanelResult<PanelWhatsApp>> {
  const [line, conversations] = await Promise.all([
    callChannelRpc(db, userId, "client_whatsapp_status", {}, preview),
    callChannelRpc(
      db,
      userId,
      "client_whatsapp_conversations",
      { _limit: CONVERSATIONS_PAGE_SIZE, _offset: page * CONVERSATIONS_PAGE_SIZE },
      preview,
    ),
  ]);
  if (line === undefined || conversations === undefined) return UNAVAILABLE;
  return ok({ line: parseWhatsAppLine(line), conversations: parseConversations(conversations) });
}

export interface MessagesCursor {
  before: string;
  beforeId: string;
}

export async function loadPanelMessages(
  db: Db,
  userId: string,
  preview: string | undefined,
  conversationId: string,
  cursor: MessagesCursor | null,
): Promise<PanelResult<WhatsAppMessage[]>> {
  const raw = await callChannelRpc(
    db,
    userId,
    "client_whatsapp_messages",
    {
      _conversation_id: conversationId,
      _limit: MESSAGES_PAGE_SIZE,
      _before: cursor?.before ?? null,
      _before_id: cursor?.beforeId ?? null,
    },
    preview,
  );
  return raw === undefined ? UNAVAILABLE : ok(parseMessages(raw));
}

// ── Instagram ───────────────────────────────────────────────────────────────

/** URLs de imágenes del overview (posts, destacadas y avatares). */
function overviewUrls(o: InstagramOverview): string[] {
  const profile = o.profile ?? {};
  return [
    profile.current_avatar_url,
    profile.proposed_avatar_url,
    ...o.posts.flatMap((p) => [p.imageUrl, p.coverUrl, ...p.carouselUrls]),
    ...o.highlights.flatMap((h) => [h.coverUrl, ...h.mediaUrls]),
  ].filter((u): u is string => typeof u === "string" && u !== "");
}

/**
 * Firma las rutas de client-media de ESTE cliente (1 hora) y descarta cualquier
 * otra URL de Storage; las externas (CDN de Instagram) quedan igual.
 */
export function withSignedMedia(
  o: InstagramOverview,
  signed: Map<string, string>,
): InstagramOverview {
  const resolve = makeResolver(o.brandId, signed);
  const list = (urls: string[]) => urls.flatMap((u) => resolve(u) ?? []);
  const profile = o.profile
    ? {
        ...o.profile,
        current_avatar_url: resolve(
          typeof o.profile.current_avatar_url === "string" ? o.profile.current_avatar_url : null,
        ),
        proposed_avatar_url: resolve(
          typeof o.profile.proposed_avatar_url === "string" ? o.profile.proposed_avatar_url : null,
        ),
      }
    : null;
  return {
    ...o,
    profile,
    posts: o.posts.map((p) => ({
      ...p,
      imageUrl: resolve(p.imageUrl),
      coverUrl: resolve(p.coverUrl),
      carouselUrls: list(p.carouselUrls),
    })),
    highlights: o.highlights.map((h) => ({
      ...h,
      coverUrl: resolve(h.coverUrl),
      mediaUrls: list(h.mediaUrls),
    })),
  };
}

export async function loadPanelInstagram(
  db: Db,
  userId: string,
  preview: string | undefined,
): Promise<PanelResult<InstagramOverview>> {
  const raw = await callChannelRpc(db, userId, "client_instagram_overview", {}, preview);
  if (raw === undefined) return UNAVAILABLE;
  const overview = parseInstagramOverview(raw);
  if (!overview) return { status: "no_client" };
  // En vista previa la RPC devuelve el cliente pedido; si no, algo no cuadra.
  if (preview && overview.brandId !== preview) throw new PanelPreviewDenied();
  const paths = overviewUrls(overview).flatMap((u) => clientMediaPath(u, overview.brandId) ?? []);
  const signed = await signPaths(CLIENT_MEDIA_BUCKET, paths);
  return ok(withSignedMedia(overview, signed));
}
