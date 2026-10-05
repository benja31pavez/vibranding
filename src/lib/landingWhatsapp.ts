// Shared helpers for the landing-page WhatsApp CTA.
// The prefilled message carries a short reference token so an inbound
// conversation can be traced back to the page that produced it.

export type LandingWaConfig = {
  id: string;
  whatsapp_enabled?: boolean | null;
  whatsapp_number?: string | null;
  whatsapp_cta_text?: string | null;
  whatsapp_message?: string | null;
};

/** "LP-1a2b3c4d" — first 8 hex chars of the landing page id. */
export function landingRefToken(landingId: string): string {
  return `LP-${landingId.replace(/-/g, "").slice(0, 8)}`;
}

export const LANDING_REF_RE = /ref:\s*LP-([0-9a-f]{8})/i;

/** Extracts the landing reference prefix from an inbound WhatsApp text. */
export function parseLandingRef(text: string): string | null {
  const m = LANDING_REF_RE.exec(text ?? "");
  return m ? m[1].toLowerCase() : null;
}

export function landingWhatsappText(lp: LandingWaConfig): string {
  const base = (
    lp.whatsapp_message || "Hola, vengo desde su página web y quiero más información."
  ).trim();
  return `${base}\n\n(Ref: ${landingRefToken(lp.id)})`;
}

/** Builds the wa.me link, or null when the CTA is off / has no number. */
export function landingWhatsappUrl(lp: LandingWaConfig): string | null {
  if (!lp.whatsapp_enabled) return null;
  const digits = (lp.whatsapp_number ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(landingWhatsappText(lp))}`;
}
