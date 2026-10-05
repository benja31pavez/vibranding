/**
 * Modelo de borrador del editor de landing: normaliza la fila de Supabase,
 * valida antes de guardar/publicar y aplica plantillas por rubro.
 * Todo es inmutable: cada helper devuelve un objeto nuevo.
 */
import { safeHref, safeWebUrl } from "@/lib/site/safeUrl";
import type { Json } from "@/integrations/supabase/types";
import {
  asArray,
  asObject,
  defaultHours,
  resolveHiddenSections,
  resolveSectionOrder,
  serializeSectionOrder,
  type FaqItem,
  type GalleryItem,
  type HeroAspect,
  type LandingFooter,
  type LandingLocation,
  type LandingSectionKey,
  type LandingTemplate,
  type Testimonial,
} from "@/lib/landingTheme";
import { RUBRO_TEMPLATES, type RubroTemplate } from "@/lib/site/landingTemplates";
import {
  emailError,
  mapEmbedError,
  normalizeChileMobile,
  normalizeUrl,
  urlError,
  whatsappError,
} from "@/lib/site/validation";

export type Service = { title: string; description: string; icon?: string };

export type LandingDraft = {
  id: string;
  client_id: string;
  slug: string;
  published: boolean;
  theme_color: string;
  hero_title: string;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
  services: Service[];
  gallery: GalleryItem[];
  contact_enabled: boolean;
  view_count: number;
  whatsapp_enabled: boolean;
  whatsapp_number: string | null;
  whatsapp_cta_text: string | null;
  whatsapp_message: string | null;
  template: LandingTemplate;
  dark_mode: boolean;
  hero_aspect: HeroAspect;
  testimonials_enabled: boolean;
  testimonials: Testimonial[];
  location_enabled: boolean;
  location: LandingLocation;
  faq_enabled: boolean;
  faq: FaqItem[];
  footer: LandingFooter;
  seo_title: string | null;
  seo_description: string | null;
  /** Orden visible de las secciones (sin prefijos "hidden:"). */
  section_order: LandingSectionKey[];
  /** Servicios / galería ocultados manualmente. */
  hidden_sections: LandingSectionKey[];
};

/** Marcador que se muestra en los testimonios vacíos: nunca se publica. */
export const TESTIMONIAL_PLACEHOLDER = "Escribe aquí un testimonio real de un cliente";

/** Aplica valores por defecto para que landings antiguas sigan funcionando. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fila cruda de Supabase
export function normalizeLanding(row: Record<string, any>): LandingDraft {
  const location = asObject<LandingLocation>(row.location);
  return {
    ...(row as LandingDraft),
    theme_color: row.theme_color || "#15803d",
    hero_title: row.hero_title ?? "",
    services: asArray<Service>(row.services),
    gallery: asArray<GalleryItem>(row.gallery),
    contact_enabled: row.contact_enabled !== false,
    whatsapp_enabled: !!row.whatsapp_enabled,
    template: (row.template ?? "classic") as LandingTemplate,
    dark_mode: !!row.dark_mode,
    hero_aspect: (row.hero_aspect ?? "square") as HeroAspect,
    testimonials_enabled: !!row.testimonials_enabled,
    testimonials: asArray<Testimonial>(row.testimonials),
    location_enabled: !!row.location_enabled,
    location: { ...location, hours: location.hours?.length ? location.hours : defaultHours() },
    faq_enabled: !!row.faq_enabled,
    faq: asArray<FaqItem>(row.faq),
    footer: asObject<LandingFooter>(row.footer),
    section_order: resolveSectionOrder(row.section_order),
    hidden_sections: resolveHiddenSections(row.section_order),
    view_count: Number(row.view_count ?? 0),
  };
}

/** Normaliza teléfonos y URLs al formato que se guarda. */
function cleanForSave(lp: LandingDraft): LandingDraft {
  const footer = lp.footer;
  // Defensa extra: aunque la validación ya bloquea, nunca se guarda un esquema fuera de la allowlist.
  const url = (v: string | null | undefined) => safeHref(normalizeUrl(v));
  return {
    ...lp,
    whatsapp_number:
      normalizeChileMobile(lp.whatsapp_number) ?? (lp.whatsapp_number?.trim() || null),
    cta_url: lp.cta_url?.trim().startsWith("#") ? lp.cta_url.trim() : url(lp.cta_url),
    footer: {
      ...footer,
      whatsapp: normalizeChileMobile(footer.whatsapp) ?? (footer.whatsapp?.trim() || undefined),
      instagram: url(footer.instagram) ?? undefined,
      facebook: url(footer.facebook) ?? undefined,
      tiktok: url(footer.tiktok) ?? undefined,
      legal: (footer.legal ?? [])
        .map((l) => ({ label: l.label.trim(), url: safeWebUrl(normalizeUrl(l.url)) ?? "" }))
        .filter((l) => l.label || l.url),
    },
    location: {
      ...lp.location,
      comunas: (lp.location.comunas ?? []).map((c) => c.trim()).filter(Boolean),
    },
  };
}

const json = (v: unknown) => v as Json;

/** Payload para `landing_pages.update` (sin columnas de sólo lectura). */
export function landingUpdatePayload(raw: LandingDraft, slug: string) {
  const lp = cleanForSave(raw);
  return {
    slug,
    theme_color: lp.theme_color,
    hero_title: lp.hero_title.trim(),
    hero_subtitle: lp.hero_subtitle,
    hero_image_url: lp.hero_image_url,
    cta_text: lp.cta_text,
    cta_url: lp.cta_url,
    services: json(lp.services),
    gallery: json(lp.gallery),
    contact_enabled: lp.contact_enabled,
    whatsapp_enabled: lp.whatsapp_enabled,
    whatsapp_number: lp.whatsapp_number,
    whatsapp_cta_text: lp.whatsapp_cta_text,
    whatsapp_message: lp.whatsapp_message,
    template: lp.template,
    dark_mode: lp.dark_mode,
    hero_aspect: lp.hero_aspect,
    testimonials_enabled: lp.testimonials_enabled,
    // Los testimonios vacíos se guardan como marcadores; la vista pública los omite.
    testimonials: json(lp.testimonials),
    location_enabled: lp.location_enabled,
    location: json(lp.location),
    faq_enabled: lp.faq_enabled,
    faq: json(lp.faq.filter((f) => f.question.trim() || f.answer.trim())),
    footer: json(lp.footer),
    seo_title: lp.seo_title?.trim() || null,
    seo_description: lp.seo_description?.trim() || null,
    section_order: serializeSectionOrder(lp.section_order, lp.hidden_sections),
  };
}

/** Lo que la vista pública necesita (section_order con prefijos "hidden:"). */
export function landingForView(lp: LandingDraft): Record<string, unknown> {
  return { ...lp, section_order: serializeSectionOrder(lp.section_order, lp.hidden_sections) };
}

/* ---------------- secciones activables ---------------- */

export function isSectionEnabled(lp: LandingDraft, key: LandingSectionKey): boolean {
  switch (key) {
    case "servicios":
    case "galeria":
      return !lp.hidden_sections.includes(key);
    case "whatsapp":
      return lp.whatsapp_enabled;
    case "testimonios":
      return lp.testimonials_enabled;
    case "ubicacion":
      return lp.location_enabled;
    case "faq":
      return lp.faq_enabled;
    case "contacto":
      return lp.contact_enabled;
  }
}

export function setSectionEnabled(
  lp: LandingDraft,
  key: LandingSectionKey,
  on: boolean,
): LandingDraft {
  switch (key) {
    case "servicios":
    case "galeria": {
      const rest = lp.hidden_sections.filter((k) => k !== key);
      return { ...lp, hidden_sections: on ? rest : [...rest, key] };
    }
    case "whatsapp":
      return { ...lp, whatsapp_enabled: on };
    case "testimonios":
      return { ...lp, testimonials_enabled: on };
    case "ubicacion":
      return { ...lp, location_enabled: on };
    case "faq":
      return { ...lp, faq_enabled: on };
    case "contacto":
      return { ...lp, contact_enabled: on };
  }
}

/* ---------------- validación ---------------- */

export type LandingErrors = Partial<Record<string, string>>;

export const FIELD_LABEL: Record<string, string> = {
  slug: "Dirección (slug)",
  hero_title: "Título principal",
  cta_url: "Enlace del botón principal",
  whatsapp_number: "WhatsApp de la landing",
  "location.map_embed_url": "Mapa de Google",
  "footer.email": "Email del pie",
  "footer.whatsapp": "WhatsApp del pie",
  "footer.instagram": "Instagram",
  "footer.facebook": "Facebook",
  "footer.tiktok": "TikTok",
};

export function validateLanding(lp: LandingDraft): LandingErrors {
  const e: LandingErrors = {};
  if (!lp.slug.trim()) e.slug = "Escribe la dirección de la página";
  if (!lp.hero_title.trim()) e.hero_title = "Escribe el nombre o la propuesta principal";
  const cta = urlError(normalizeUrl(lp.cta_url), { allowAnchor: true });
  if (cta) e.cta_url = cta;
  if (lp.whatsapp_enabled) {
    const wa = whatsappError(lp.whatsapp_number);
    if (wa) e.whatsapp_number = wa;
  }
  const map = mapEmbedError(lp.location.map_embed_url);
  if (lp.location_enabled && map) e["location.map_embed_url"] = map;
  const email = emailError(lp.footer.email);
  if (email) e["footer.email"] = email;
  const footerWa = whatsappError(lp.footer.whatsapp, true);
  if (footerWa) e["footer.whatsapp"] = footerWa;
  for (const k of ["instagram", "facebook", "tiktok"] as const) {
    const err = urlError(normalizeUrl(lp.footer[k]));
    if (err) e[`footer.${k}`] = err;
  }
  (lp.footer.legal ?? []).forEach((l, i) => {
    const err = l.url.trim()
      ? urlError(normalizeUrl(l.url))
      : l.label.trim()
        ? "Falta la URL"
        : null;
    if (err) e[`footer.legal.${i}`] = err;
  });
  return e;
}

/* ---------------- plantillas por rubro ---------------- */

/** Todos los textos de ejemplo de las plantillas: se marcan para reemplazar. */
const EXAMPLE_TEXTS = new Set<string>(
  RUBRO_TEMPLATES.flatMap((t) => [
    t.hero_subtitle,
    ...t.services.flatMap((s) => [s.title, s.description]),
    ...t.faq.flatMap((f) => [f.question, f.answer]),
  ]),
);

export function isExampleText(value: string | null | undefined): boolean {
  return !!value && EXAMPLE_TEXTS.has(value.trim());
}

/** Cuenta los textos de ejemplo que siguen sin reemplazar en secciones visibles. */
export function countExampleTexts(lp: LandingDraft): number {
  let n = isExampleText(lp.hero_subtitle) ? 1 : 0;
  if (isSectionEnabled(lp, "servicios")) {
    n += lp.services.filter((s) => isExampleText(s.title) || isExampleText(s.description)).length;
  }
  if (lp.faq_enabled) {
    n += lp.faq.filter((f) => isExampleText(f.question) || isExampleText(f.answer)).length;
  }
  return n;
}

/** Aplica una plantilla de rubro manteniendo identidad (slug, nombre, fotos, contacto). */
export function applyRubroTemplate(
  lp: LandingDraft,
  t: RubroTemplate,
  clientName: string,
): LandingDraft {
  const name = lp.hero_title.trim() || clientName;
  const placeholders: Testimonial[] = [
    { name: "", quote: "" },
    { name: "", quote: "" },
  ];
  return {
    ...lp,
    hero_title: name,
    theme_color: t.theme_color,
    template: t.template,
    dark_mode: t.dark_mode,
    hero_subtitle: t.hero_subtitle,
    cta_text: t.cta_text,
    cta_url: null,
    whatsapp_cta_text: t.whatsapp_cta_text,
    whatsapp_message: t.whatsapp_message,
    services: t.services.map((s) => ({ ...s })),
    faq: t.faq.map((f) => ({ ...f })),
    testimonials: lp.testimonials.some((x) => x.quote.trim()) ? lp.testimonials : placeholders,
    section_order: [...t.section_order],
    hidden_sections: [],
    whatsapp_enabled: t.enable.whatsapp,
    testimonials_enabled: t.enable.testimonios,
    location_enabled: t.enable.ubicacion,
    faq_enabled: t.enable.faq,
    contact_enabled: t.enable.contacto,
    seo_description: t.seo_description(name),
  };
}
