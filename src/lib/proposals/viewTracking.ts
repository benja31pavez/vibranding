/**
 * ¿Esta petición a /p/$token es una persona abriendo la propuesta?
 *
 * Al pegar un link en WhatsApp, Slack, etc., el servicio descarga la página
 * para armar la vista previa ANTES de que el cliente la abra. Si marcáramos
 * "vista" en ese momento, la agencia vería "Vista" sin que nadie la haya leído.
 *
 * Heurística (conservadora: ante la duda NO se marca):
 *  1. Solo GET/POST. HEAD (chequeos de link) no cuenta.
 *  2. Prefetch/prerender del navegador no cuenta: cabeceras `Purpose`,
 *     `Sec-Purpose`, `X-Purpose` o `X-Moz` con "prefetch"/"preview"/"prerender".
 *  3. User-Agent vacío o de bots/vistas previas conocidas no cuenta
 *     (WhatsApp, facebookexternalhit/Facebot/Meta, Slackbot, TelegramBot,
 *     Twitterbot, LinkedInBot, Discordbot, Skype, iMessage/Apple, Google/Bing,
 *     curl/wget/librerías HTTP y cualquier UA con "bot", "crawler", "spider",
 *     "preview" o "headless"). Los navegadores internos de Instagram,
 *     Facebook o Snapchat SÍ cuentan (son personas).
 *  4. `?vista=interna` (los links "Abrir" del editor interno) no cuenta.
 *
 * Límite conocido: un bot que se haga pasar por navegador sí marca "vista".
 * Es solo una señal comercial; nunca habilita ni bloquea nada.
 */

const BOT_UA =
  /whatsapp|facebookexternalhit|facebot|meta-externalagent|slack|telegrambot|twitterbot|linkedinbot|discordbot|skypeuripreview|applebot|imessage|google|bingbot|bingpreview|yandex|duckduckbot|baiduspider|embedly|redditbot|vkshare|quora link preview|outlook|microsoftpreview|bot\b|bot\/|crawler|spider|preview|headless|curl|wget|python-requests|python-urllib|go-http-client|node-fetch|axios|okhttp|java\/|libwww|httpclient/i;

const PREFETCH_HEADERS = ["purpose", "sec-purpose", "x-purpose", "x-moz"] as const;
const PREFETCH_VALUE = /prefetch|preview|prerender/i;

export interface ViewSignal {
  method: string;
  headers: Pick<Headers, "get">;
  /** Valor de `?vista=` de la URL de la página, si vino. */
  vistaParam?: string | null;
}

export type ViewDecision =
  { mark: true } | { mark: false; reason: "method" | "prefetch" | "bot" | "internal" };

export function decideMarkViewed(signal: ViewSignal): ViewDecision {
  const method = signal.method.toUpperCase();
  if (method !== "GET" && method !== "POST") return { mark: false, reason: "method" };
  if (signal.vistaParam === "interna") return { mark: false, reason: "internal" };
  for (const name of PREFETCH_HEADERS) {
    const value = signal.headers.get(name);
    if (value && PREFETCH_VALUE.test(value)) return { mark: false, reason: "prefetch" };
  }
  const ua = signal.headers.get("user-agent")?.trim() ?? "";
  if (!ua || BOT_UA.test(ua)) return { mark: false, reason: "bot" };
  return { mark: true };
}
