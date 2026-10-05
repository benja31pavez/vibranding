import { supabase } from "@/integrations/supabase/client";

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

/** Reads the campaign parameters from the current URL. */
export function readUtm() {
  if (typeof window === "undefined") return { source: null, medium: null, campaign: null };
  const p = new URLSearchParams(window.location.search);
  return {
    source: p.get("utm_source"),
    medium: p.get("utm_medium"),
    campaign: p.get("utm_campaign"),
  };
}

/**
 * Records one event through the log_landing_event function, which resolves the
 * owning client server-side. landing_events is the source of truth; the
 * view_count / click_count columns are only cached totals.
 */
export function trackEvent(name: LandingEventName, source: EventSource, lang?: string) {
  if (typeof window === "undefined") return;
  const utm = readUtm();
  // Fire and forget — never block navigation
  void (supabase.rpc as any)("log_landing_event", {
    _event_name: name,
    _source_type: source.type,
    _source_id: source.type === "site" ? null : source.id,
    _item_id: source.type === "multilink" ? source.itemId ?? null : null,
    _lang: lang ?? null,
    _path: window.location.pathname + window.location.search,
    _referrer: document.referrer || null,
    _user_agent: navigator.userAgent,
    _utm_source: utm.source,
    _utm_medium: utm.medium,
    _utm_campaign: utm.campaign,
  }).then(({ error }: { error: { message: string } | null }) => {
    if (error) console.warn("[track]", name, error.message);
  });
}

/** Agency marketing site events. */
export function trackLandingEvent(name: LandingEventName, lang?: string) {
  trackEvent(name, { type: "site" }, lang);
}
