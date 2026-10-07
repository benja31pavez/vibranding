import { supabase } from "@/integrations/supabase/client";

/**
 * Lecturas del panel del cliente para Leads, WhatsApp e Instagram.
 *
 * Solo llaman RPC `client_*` (SECURITY DEFINER, migración 20261012002910):
 * el cliente lo fija la base con user_client_id(), así que NINGUNA función
 * recibe un clientId. Leads, conversaciones y mensajes se paginan en el
 * servidor. Las respuestas se validan aquí (nunca se confía en la forma).
 */

type RpcError = { message: string; code?: string };

const LOAD_ERROR = "No pudimos cargar esta sección. Intenta de nuevo.";

/** Los RPC aún no están en los tipos generados: se validan a mano. */
async function callRpc(
  fn:
    | "client_leads_page"
    | "client_whatsapp_status"
    | "client_whatsapp_conversations"
    | "client_whatsapp_messages"
    | "client_instagram_overview",
  args: Record<string, unknown>,
  call: () => PromiseLike<{ data: unknown; error: RpcError | null }>,
): Promise<unknown> {
  const { data, error } = await call();
  if (error) {
    console.error(`[client-panel] ${fn} falló`, error.code, error.message, args);
    throw new Error(LOAD_ERROR);
  }
  return data;
}

/* ───────────── Helpers de validación ───────────── */

type Row = Record<string, unknown>;

function rows(data: unknown): Row[] {
  if (!Array.isArray(data)) return [];
  return data.filter((r): r is Row => typeof r === "object" && r !== null);
}
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const bool = (v: unknown): boolean => v === true;
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Número de WhatsApp (wa_id viene sin "+"). */
function asPhone(v: string | null): string | null {
  return v && /^\d+$/.test(v) ? `+${v}` : v;
}

/** Total de filas que trae cada fila (count(*) OVER ()). */
function totalOf(list: Row[]): number {
  return list.length > 0 ? (num(list[0].total_count) ?? list.length) : 0;
}

export interface Page<T> {
  items: T[];
  total: number;
}

/* ───────────── Leads ───────────── */

export type LeadSource = "whatsapp" | "landing" | "meta_ads" | "multilink";
export type LeadStatus = "new" | "contacted" | "won" | "lost";

export interface ClientLead {
  key: string;
  source: LeadSource;
  name: string;
  contact: string | null;
  message: string | null;
  createdAt: string | null;
  status: LeadStatus;
}

const LEAD_SOURCES: readonly LeadSource[] = ["whatsapp", "landing", "meta_ads", "multilink"];
const LEAD_STATUSES: readonly LeadStatus[] = ["new", "contacted", "won", "lost"];

export const LEADS_PAGE_SIZE = 10;

export async function fetchClientLeads(page: number): Promise<Page<ClientLead>> {
  const args = { _limit: LEADS_PAGE_SIZE, _offset: page * LEADS_PAGE_SIZE };
  const data = await callRpc("client_leads_page", args, () =>
    supabase.rpc("client_leads_page" as never, args as never),
  );
  const list = rows(data);
  return {
    total: totalOf(list),
    items: list.map((r) => {
      const source = LEAD_SOURCES.find((s) => s === r.source) ?? "multilink";
      return {
        key: `${source}-${str(r.lead_id) ?? ""}`,
        source,
        name: str(r.name) ?? "Sin nombre",
        contact: source === "whatsapp" ? asPhone(str(r.contact)) : str(r.contact),
        message: str(r.message),
        createdAt: str(r.created_at),
        status: LEAD_STATUSES.find((s) => s === r.status) ?? "new",
      };
    }),
  };
}

/* ───────────── WhatsApp ───────────── */

export interface WhatsAppLine {
  connected: boolean;
  phone: string | null;
  businessName: string | null;
}

/** null = el cliente no tiene WhatsApp configurado. */
export async function fetchWhatsAppLine(): Promise<WhatsAppLine | null> {
  const data = await callRpc("client_whatsapp_status", {}, () =>
    supabase.rpc("client_whatsapp_status" as never),
  );
  const row = rows(data)[0];
  if (!row) return null;
  return {
    connected: bool(row.connected),
    phone: str(row.display_phone_number),
    businessName: str(row.business_name),
  };
}

export interface WhatsAppConversation {
  id: string;
  name: string;
  phone: string | null;
  lastMessageAt: string | null;
  preview: string | null;
  unread: number;
  isLead: boolean;
}

export const CONVERSATIONS_PAGE_SIZE = 10;

export async function fetchWhatsAppConversations(
  page: number,
): Promise<Page<WhatsAppConversation>> {
  const args = { _limit: CONVERSATIONS_PAGE_SIZE, _offset: page * CONVERSATIONS_PAGE_SIZE };
  const data = await callRpc("client_whatsapp_conversations", args, () =>
    supabase.rpc("client_whatsapp_conversations" as never, args as never),
  );
  const list = rows(data).filter((r) => str(r.id));
  return {
    total: totalOf(list),
    items: list.map((r) => {
      const phone = str(r.contact_phone);
      return {
        id: String(r.id),
        name: str(r.contact_name) ?? (phone ? `+${phone}` : "Contacto"),
        phone,
        lastMessageAt: str(r.last_message_at),
        preview: str(r.last_message_preview),
        unread: num(r.unread_count) ?? 0,
        isLead: bool(r.is_lead),
      };
    }),
  };
}

export interface WhatsAppMessage {
  id: string;
  outbound: boolean;
  fromBot: boolean;
  type: string;
  body: string | null;
  status: string | null;
  sentAt: string | null;
}

export const MESSAGES_PAGE_SIZE = 40;

/** Mensajes más nuevos primero; `before` = fecha del más antiguo ya cargado. */
export async function fetchWhatsAppMessages(
  conversationId: string,
  before: string | null,
): Promise<WhatsAppMessage[]> {
  const args = { _conversation_id: conversationId, _limit: MESSAGES_PAGE_SIZE, _before: before };
  const data = await callRpc("client_whatsapp_messages", args, () =>
    supabase.rpc("client_whatsapp_messages" as never, args as never),
  );
  return rows(data)
    .filter((r) => str(r.id))
    .map((r) => ({
      id: String(r.id),
      outbound: r.direction === "outbound",
      fromBot: bool(r.from_bot),
      type: str(r.type) ?? "text",
      body: str(r.body),
      status: str(r.status),
      sentAt: str(r.sent_at),
    }));
}

/* ───────────── Instagram ───────────── */

export type IgSide = "current" | "proposed";
export type IgFormat = "photo" | "carousel" | "reel";

export interface IgPostView {
  id: string;
  type: IgSide;
  position: number;
  format: IgFormat;
  imageUrl: string | null;
  coverUrl: string | null;
  carouselUrls: string[];
  caption: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  likes: number;
  isTrialReel: boolean;
  closeFriendsOnly: boolean;
  music: string | null;
  location: string | null;
  approvalStatus: string | null;
}

export interface IgHighlightView {
  id: string;
  type: IgSide;
  position: number;
  title: string | null;
  coverUrl: string | null;
  mediaUrls: string[];
}

export interface IgEngagementView {
  measuredAt: string;
  followers: number | null;
  rate: number;
  avgLikes: number | null;
  avgComments: number | null;
  postsPerWeek: number | null;
  postsSampled: number | null;
}

export interface InstagramOverview {
  /** Fila cruda del perfil (solo columnas current_* / proposed_*), o null. */
  profile: Row | null;
  currentVersion: { label: string; capturedAt: string | null } | null;
  posts: IgPostView[];
  highlights: IgHighlightView[];
  engagement: IgEngagementView | null;
}

const asSide = (v: unknown): IgSide => (v === "current" ? "current" : "proposed");
const asFormat = (v: unknown): IgFormat => (v === "carousel" || v === "reel" ? v : "photo");
const asObject = (v: unknown): Row | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Row) : null;

function parseEngagement(v: unknown): IgEngagementView | null {
  const e = asObject(v);
  const rate = num(e?.engagement_rate);
  const measuredAt = str(e?.measured_at);
  if (!e || rate === null || !measuredAt) return null;
  return {
    measuredAt,
    rate,
    followers: num(e.followers),
    avgLikes: num(e.avg_likes),
    avgComments: num(e.avg_comments),
    postsPerWeek: num(e.posts_per_week),
    postsSampled: num(e.posts_sampled),
  };
}

export async function fetchInstagramOverview(): Promise<InstagramOverview> {
  const data = await callRpc("client_instagram_overview", {}, () =>
    supabase.rpc("client_instagram_overview" as never),
  );
  const root = asObject(data);
  const version = asObject(root?.current_version);
  return {
    profile: asObject(root?.profile),
    currentVersion: version
      ? { label: str(version.label) ?? "Actual", capturedAt: str(version.captured_at) }
      : null,
    posts: rows(root?.posts)
      .filter((p) => str(p.id))
      .map((p) => ({
        id: String(p.id),
        type: asSide(p.type),
        position: num(p.position) ?? 0,
        format: asFormat(p.format),
        imageUrl: str(p.image_url),
        coverUrl: str(p.cover_url),
        carouselUrls: strList(p.carousel_urls),
        caption: str(p.caption),
        scheduledAt: str(p.scheduled_at),
        publishedAt: str(p.published_at),
        likes: num(p.likes_count) ?? 0,
        isTrialReel: bool(p.is_trial_reel),
        closeFriendsOnly: bool(p.close_friends_only),
        music: str(p.music),
        location: str(p.location),
        approvalStatus: str(p.approval_status),
      })),
    highlights: rows(root?.highlights)
      .filter((h) => str(h.id))
      .map((h) => ({
        id: String(h.id),
        type: asSide(h.type),
        position: num(h.position) ?? 0,
        title: str(h.title),
        coverUrl: str(h.cover_url),
        mediaUrls: strList(h.media_urls),
      })),
    engagement: parseEngagement(root?.engagement),
  };
}
