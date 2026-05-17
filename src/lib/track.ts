import { supabase } from "@/integrations/supabase/client";

export type LandingEventName = "contact_click" | "whatsapp_click";

export function trackLandingEvent(name: LandingEventName, lang?: string) {
  if (typeof window === "undefined") return;
  // Fire and forget — never block navigation
  void supabase.from("landing_events").insert({
    event_name: name,
    lang: lang ?? null,
    path: window.location.pathname + window.location.search,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent,
  }).then(({ error }) => {
    if (error) console.warn("[track]", name, error.message);
  });
}
