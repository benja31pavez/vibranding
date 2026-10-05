import { supabase } from "@/integrations/supabase/client";
import { cleanPath, firstTouchFrom, type FirstTouch } from "@/lib/analytics/attribution";
import { CTA_ID_PATTERN } from "@/lib/analytics/visitor";

export type LandingEventName =
  | "page_view"
  | "link_click"
  | "whatsapp_click"
  | "contact_click"
  | "contact_submit";

export type EventSource =
  | { type: "site" }
  | { type: "landing"; id: string }
  | { type: "multilink"; id: string; itemId?: string };

/** localStorage: "1" = este navegador no cuenta en las estadísticas ("no contarme"). */
export const NO_COUNT_KEY = "vb:analytics:no-contarme";
const SESSION_KEY = "vb:analytics:sid";
const TOUCH_KEY = "vb:analytics:touch";
const VIEWS_KEY = "vb:analytics:views";
/** Doble clic o rebote del mismo CTA dentro de esta ventana cuenta una vez. */
const CLICK_DEDUPE_MS = 2000;

// Respaldo en memoria si sessionStorage no está disponible (modo privado estricto).
const memory = { sid: "", touch: null as FirstTouch | null, views: new Set<string>() };
const lastClicks = new Map<string, number>();

function readStorage(store: "local" | "session", key: string): string | null {
  try {
    return (store === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(store: "local" | "session", key: string, value: string | null): void {
  try {
    const s = store === "local" ? window.localStorage : window.sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    // Almacenamiento bloqueado: se usa el respaldo en memoria.
  }
}

export function isCountingDisabled(): boolean {
  if (typeof window === "undefined") return true;
  return readStorage("local", NO_COUNT_KEY) === "1";
}

export function setCountingDisabled(disabled: boolean): void {
  if (typeof window === "undefined") return;
  writeStorage("local", NO_COUNT_KEY, disabled ? "1" : null);
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function sessionId(): string {
  const stored = readStorage("session", SESSION_KEY) ?? memory.sid;
  if (stored) return stored;
  const sid = newId();
  memory.sid = sid;
  writeStorage("session", SESSION_KEY, sid);
  return sid;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Primer contacto de la sesión: se fija en el primer evento y no cambia. */
function firstTouch(): FirstTouch {
  const stored = parseJson<FirstTouch | null>(readStorage("session", TOUCH_KEY), null);
  if (stored) return stored;
  if (memory.touch) return memory.touch;
  const touch = firstTouchFrom({
    search: window.location.search,
    referrer: document.referrer || null,
    ownHost: window.location.hostname,
    pathname: window.location.pathname,
  });
  memory.touch = touch;
  writeStorage("session", TOUCH_KEY, JSON.stringify(touch));
  return touch;
}

/** true la primera vez en la sesión para esta página (recargas y dobles montajes no suman). */
function firstViewInSession(key: string): boolean {
  if (memory.views.has(key)) return false;
  memory.views.add(key);
  const seen = parseJson<string[]>(readStorage("session", VIEWS_KEY), []);
  if (seen.includes(key)) return false;
  writeStorage("session", VIEWS_KEY, JSON.stringify([...seen, key]));
  return true;
}

function isDuplicateClick(key: string): boolean {
  const now = Date.now();
  const last = lastClicks.get(key) ?? 0;
  lastClicks.set(key, now);
  return now - last < CLICK_DEDUPE_MS;
}

/** Integrantes del equipo con sesión iniciada no cuentan en las estadísticas públicas. */
async function isTeamMember(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session);
  } catch {
    return false;
  }
}

async function send(
  name: LandingEventName,
  source: EventSource,
  path: string,
  lang: string | undefined,
  cta: string | undefined,
): Promise<void> {
  if (await isTeamMember()) return;
  const { recordLandingEvent } = await import("@/lib/analytics/record.functions");
  await recordLandingEvent({
    data: {
      event: name,
      sourceType: source.type,
      sourceId: source.type === "site" ? null : source.id,
      itemId: source.type === "multilink" ? (source.itemId ?? null) : null,
      lang: lang ?? null,
      path,
      sessionId: sessionId(),
      cta: cta && CTA_ID_PATTERN.test(cta) ? cta : null,
      webdriver: navigator.webdriver === true,
      touch: firstTouch(),
    },
  });
}

/**
 * Registra un evento (fire and forget). El servidor descarta bots y calcula el
 * visitante único del día; landing_events es la fuente de verdad y
 * view_count / click_count son solo totales en caché.
 */
export function trackEvent(
  name: LandingEventName,
  source: EventSource,
  lang?: string,
  cta?: string,
): void {
  if (typeof window === "undefined" || isCountingDisabled()) return;
  const path = cleanPath(window.location.pathname);
  const sourceKey = `${source.type}:${source.type === "site" ? "" : source.id}`;
  if (name === "page_view" && !firstViewInSession(`${sourceKey}:${path}`)) return;
  const itemKey = source.type === "multilink" ? (source.itemId ?? "") : "";
  if (name !== "page_view" && isDuplicateClick(`${sourceKey}:${name}:${itemKey}:${cta ?? ""}`)) {
    return;
  }
  // Nunca bloquea la navegación ni rompe la página.
  send(name, source, path, lang, cta).catch((e: unknown) => {
    console.warn("[track]", name, e instanceof Error ? e.message : "error");
  });
}

/** Eventos del sitio de la agencia. `cta` identifica el botón (p. ej. "plan:crecimiento"). */
export function trackLandingEvent(name: LandingEventName, lang?: string, cta?: string): void {
  trackEvent(name, { type: "site" }, lang, cta);
}
