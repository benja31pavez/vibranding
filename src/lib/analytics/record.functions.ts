import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CTA_ID_PATTERN, SESSION_ID_PATTERN } from "./visitor";

const TRACKED_EVENTS = [
  "page_view",
  "link_click",
  "whatsapp_click",
  "contact_click",
  "contact_submit",
] as const;

const short = (max: number) => z.string().trim().max(max).nullable();

const Input = z.object({
  event: z.enum(TRACKED_EVENTS),
  sourceType: z.enum(["site", "landing", "multilink"]),
  sourceId: z.string().uuid().nullable(),
  itemId: z.string().uuid().nullable(),
  lang: short(10),
  path: z.string().max(300),
  sessionId: z.string().regex(SESSION_ID_PATTERN),
  cta: z.string().regex(CTA_ID_PATTERN).nullable(),
  /** navigator.webdriver: navegador automatizado. */
  webdriver: z.boolean(),
  touch: z.object({
    utmSource: short(120),
    utmMedium: short(120),
    utmCampaign: short(120),
    referrerDomain: short(120),
    hasGclid: z.boolean(),
    hasFbclid: z.boolean(),
    landingPath: z.string().max(200),
  }),
});
type TrackInput = z.infer<typeof Input>;

export type TrackResult = { counted: boolean };

/** Por sesión/IP y por instancia del Worker: frena el spam que inflaría los conteos. */
const MAX_EVENTS_PER_WINDOW = 60;
const WINDOW_MS = 10 * 60 * 1000;
/** Si la BD aún no tiene la función nueva, se usa la firma antigua por este tiempo. */
const LEGACY_RETRY_MS = 10 * 60 * 1000;
const FUNCTION_NOT_FOUND = "PGRST202";

let limiter: import("@/lib/security/ipRateLimit.server").RateLimiter | null = null;
let legacyUntil = 0;

type RpcResult = { error: { code?: string; message: string } | null };
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;

async function visitorHash(userAgent: string): Promise<string | null> {
  const { clientIp } = await import("@/lib/security/ipRateLimit.server");
  const ip = clientIp();
  const salt = process.env["IP_HASH_SALT"]?.trim();
  if (!ip || !salt) return null;
  const { visitorHashMaterial } = await import("./visitor");
  const { santiagoDayKey } = await import("./time");
  const { createHash } = await import("crypto");
  const material = visitorHashMaterial({ ip, userAgent, dayKey: santiagoDayKey(Date.now()), salt });
  return createHash("sha256").update(material).digest("hex");
}

function legacyArgs(d: TrackInput, userAgent: string): Record<string, unknown> {
  return {
    _event_name: d.event,
    _source_type: d.sourceType,
    _source_id: d.sourceType === "site" ? null : d.sourceId,
    _item_id: d.sourceType === "multilink" ? d.itemId : null,
    _lang: d.lang,
    _path: d.path,
    // Solo el dominio: la URL completa de origen puede traer datos personales.
    _referrer: d.touch.referrerDomain ? `https://${d.touch.referrerDomain}/` : null,
    _user_agent: userAgent,
    _utm_source: d.touch.utmSource,
    _utm_medium: d.touch.utmMedium,
    _utm_campaign: d.touch.utmCampaign,
  };
}

/** Registra por log_landing_event (la misma vía segura de siempre), con o sin migración. */
async function logEvent(full: Record<string, unknown>, legacy: Record<string, unknown>) {
  const { supabase } = await import("@/integrations/supabase/client");
  const rpc = supabase.rpc as unknown as Rpc;
  if (Date.now() >= legacyUntil) {
    const { error } = await rpc.call(supabase, "log_landing_event", full);
    if (!error) return;
    if (error.code !== FUNCTION_NOT_FOUND) {
      console.error(`[track] log_landing_event falló (code ${error.code ?? "?"})`);
      return;
    }
    legacyUntil = Date.now() + LEGACY_RETRY_MS;
  }
  const { error } = await rpc.call(supabase, "log_landing_event", legacy);
  if (error)
    console.error(`[track] log_landing_event (firma antigua) falló (code ${error.code ?? "?"})`);
}

/**
 * Registro público de eventos de landings, multilinks y el sitio. El servidor
 * descarta bots/headless/prefetch, limita el spam, calcula el hash diario del
 * visitante (sin guardar la IP) y el tipo de dispositivo desde sus cabeceras.
 */
export const recordLandingEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<TrackResult> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { isAutomatedRequest, isBotUserAgent } = await import("./bots");
    const headers = getRequest()?.headers ?? new Headers();
    const userAgent = (headers.get("user-agent") ?? "").slice(0, 500);
    if (data.webdriver || isBotUserAgent(userAgent) || isAutomatedRequest(headers)) {
      return { counted: false };
    }

    const { createRateLimiter, limitKey } = await import("@/lib/security/ipRateLimit.server");
    limiter ??= createRateLimiter(MAX_EVENTS_PER_WINDOW, WINDOW_MS);
    if (!limiter.allow(limitKey("track", data.sessionId))) return { counted: false };

    const { deviceType } = await import("./attribution");
    const legacy = legacyArgs(data, userAgent);
    const full = {
      ...legacy,
      _session_id: data.sessionId,
      _visitor_hash: await visitorHash(userAgent),
      _referrer_domain: data.touch.referrerDomain,
      _landing_path: data.touch.landingPath,
      _device_type: deviceType(userAgent),
      _has_gclid: data.touch.hasGclid,
      _has_fbclid: data.touch.hasFbclid,
      _cta: data.cta,
    };
    await logEvent(full, legacy);
    return { counted: true };
  });
