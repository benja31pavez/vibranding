/**
 * Estado de cada sección del editor de sitio (landing y multienlace) y URLs
 * públicas. Puro: sin React ni Supabase, para poder revisarlo con un script.
 */
import { SITE_URL } from "@/lib/site";
import type { LandingSectionKey } from "@/lib/landingTheme";
import { multilinkPublicUrl, type Multilink } from "@/lib/multilink";
import { landingCanonicalUrl } from "@/lib/site/landingSeo";
import { isExampleText, isSectionEnabled, type LandingDraft } from "@/lib/site/landingDraft";

export type SectionStatus = "complete" | "missing" | "example" | "hidden" | "error";

export const SECTION_STATUS_UI: Readonly<
  Record<SectionStatus, { label: string; tone: "success" | "warning" | "neutral" | "danger" }>
> = {
  complete: { label: "Completa", tone: "success" },
  missing: { label: "Falta contenido", tone: "warning" },
  example: { label: "Texto de ejemplo", tone: "warning" },
  hidden: { label: "Oculta", tone: "neutral" },
  error: { label: "Revisar", tone: "danger" },
};

const filled = (v: string | null | undefined) => !!v && v.trim().length > 0;

/** Portada: título y foto son lo mínimo; el subtítulo de plantilla cuenta como ejemplo. */
export function heroStatus(lp: LandingDraft, hasError = false): SectionStatus {
  if (hasError) return "error";
  if (!filled(lp.hero_title) || !filled(lp.hero_image_url)) return "missing";
  return isExampleText(lp.hero_subtitle) ? "example" : "complete";
}

/** Contenido mínimo de cada sección visible de la landing. */
function sectionHasContent(lp: LandingDraft, key: LandingSectionKey): boolean {
  switch (key) {
    case "servicios":
      return lp.services.some((s) => filled(s.title));
    case "galeria":
      return lp.gallery.length > 0;
    case "whatsapp":
      return filled(lp.whatsapp_number);
    case "testimonios":
      return lp.testimonials.some((t) => filled(t.quote));
    case "ubicacion":
      return (
        filled(lp.location.comuna) ||
        filled(lp.location.address) ||
        (lp.location.comunas ?? []).length > 0
      );
    case "faq":
      return lp.faq.some((f) => filled(f.question) && filled(f.answer));
    case "contacto":
      return true;
  }
}

function sectionHasExamples(lp: LandingDraft, key: LandingSectionKey): boolean {
  if (key === "servicios") {
    return lp.services.some((s) => isExampleText(s.title) || isExampleText(s.description));
  }
  if (key === "faq") {
    return lp.faq.some((f) => isExampleText(f.question) || isExampleText(f.answer));
  }
  return false;
}

export function landingSectionStatus(
  lp: LandingDraft,
  key: LandingSectionKey,
  hasError = false,
): SectionStatus {
  if (!isSectionEnabled(lp, key)) return "hidden";
  if (hasError) return "error";
  if (!sectionHasContent(lp, key)) return "missing";
  return sectionHasExamples(lp, key) ? "example" : "complete";
}

/** Multienlace: sin enlaces visibles no hay nada que mostrar. */
export function multilinkLinksStatus(
  items: { is_active: boolean }[],
  hasError = false,
): SectionStatus {
  if (hasError) return "error";
  return items.some((i) => i.is_active) ? "complete" : "missing";
}

/** URL pública de la landing: siempre el dominio de producción, nunca el de vista previa. */
export const landingPublicUrl = landingCanonicalUrl;

/** URL pública del multienlace: dominio propio verificado o el de producción. */
export function multilinkPublicUrlFor(ml: Multilink): string {
  return multilinkPublicUrl(ml, SITE_URL);
}

/** "https://vibranding.pro/@slug" → "vibranding.pro/@slug" para mostrar. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
