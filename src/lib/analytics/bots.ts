/**
 * Detección de tráfico automatizado (bots, crawlers, previsualizadores de
 * enlaces, navegadores headless y prefetch/prerender). Funciones puras: se usan
 * en el servidor al registrar y en la página Estadísticas al agregar (limpia
 * también los eventos históricos).
 */

const BOT_UA_PATTERN = new RegExp(
  [
    "bot\\b",
    "bot/",
    "crawl",
    "spider",
    "slurp",
    "bingpreview",
    "facebookexternalhit",
    "facebot",
    "embedly",
    "quora link preview",
    "pinterest/",
    "vkshare",
    "w3c_validator",
    "whatsapp/",
    "skypeuripreview",
    "yandex",
    "baiduspider",
    "semrush",
    "ahrefs",
    "bytespider",
    "gptbot",
    "chatgpt-user",
    "oai-searchbot",
    "claude-web",
    "anthropic-ai",
    "perplexity",
    "ccbot",
    "google-inspectiontool",
    "googleother",
    "mediapartners-google",
    "adsbot",
    "feedfetcher",
    "lighthouse",
    "pagespeed",
    "gtmetrix",
    "pingdom",
    "uptimerobot",
    "statuscake",
    "site24x7",
    "headless",
    "phantomjs",
    "puppeteer",
    "playwright",
    "selenium",
    "webdriver",
    "cypress",
    "python-",
    "aiohttp",
    "httpx",
    "go-http-client",
    "okhttp",
    "java/",
    "libwww",
    "wget",
    "curl/",
    "node-fetch",
    "axios/",
    "undici",
    "scrapy",
    "httpclient",
    "postmanruntime",
    "insomnia",
    "cloudflare-workers",
    "prerender",
    "rendertron",
  ].join("|"),
  "i",
);

/** true si el user-agent es de un bot/herramienta o viene vacío (ningún navegador real lo omite). */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  if (ua.length < 10) return true;
  return BOT_UA_PATTERN.test(ua);
}

/** Lectura mínima de cabeceras (Headers o un objeto simple en los checks). */
export type HeaderReader = { get(name: string): string | null };

/**
 * Señales de petición no humana a nivel de cabeceras: Chrome headless (Client
 * Hints) y peticiones de prefetch/prerender del navegador (Speculation Rules,
 * `<link rel=prefetch>`), que no son una visita.
 */
export function isAutomatedRequest(headers: HeaderReader): boolean {
  const chUa = headers.get("sec-ch-ua") ?? "";
  if (/headless/i.test(chUa)) return true;
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""} ${headers.get("x-purpose") ?? ""} ${headers.get("x-moz") ?? ""}`;
  return /prefetch|prerender|preview/i.test(purpose);
}

/** Filas sin tráfico automatizado (las que no traen user_agent se conservan). */
export function withoutBots<T extends { user_agent?: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.user_agent === undefined || !isBotUserAgent(r.user_agent));
}
