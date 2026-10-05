/**
 * SEO de la landing pública de cada cliente: meta tags y JSON-LD LocalBusiness
 * con comuna, región y teléfono, más FAQPage. Sólo describe contenido visible:
 * Google trata como spam el schema de contenido oculto.
 */
import { SITE_URL } from "@/lib/site";
import {
  asArray,
  asObject,
  resolveHiddenSections,
  type FaqItem,
  type LandingFooter,
  type LandingLocation,
  type OpeningHour,
} from "@/lib/landingTheme";
import { normalizeChileMobile } from "@/lib/site/validation";

type LandingLike = Record<string, any>;
type ServiceItem = { title: string; description?: string };

/** WEEKDAYS es lunes primero (0 = Lunes); schema.org usa el nombre en inglés. */
const SCHEMA_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function landingCanonicalUrl(slug: string): string {
  return `${SITE_URL}/@${slug}`;
}

export function landingSeoTitle(lp: LandingLike): string {
  const base = (lp.seo_title || lp.hero_title || "").trim();
  const comuna = (asObject<LandingLocation>(lp.location).comuna ?? "").trim();
  // "Paisajismo Verde | Las Condes" ayuda en búsquedas locales si el título no lo dice ya.
  if (base && comuna && !lp.seo_title && !base.toLowerCase().includes(comuna.toLowerCase())) {
    return `${base} | ${comuna}`;
  }
  return base;
}

export function landingSeoDescription(lp: LandingLike): string {
  const raw = (lp.seo_description || lp.hero_subtitle || lp.hero_title || "")
    .trim()
    .replace(/\s+/g, " ");
  return raw.length > 160 ? `${raw.slice(0, 157).trimEnd()}…` : raw;
}

/** Teléfono para schema/tel:, prioriza el del pie y si no el WhatsApp. */
export function landingPhone(lp: LandingLike): string | null {
  const footer = asObject<LandingFooter>(lp.footer);
  const phone = (footer.phone ?? "").trim();
  if (phone) return phone;
  return normalizeChileMobile(lp.whatsapp_enabled ? lp.whatsapp_number : footer.whatsapp);
}

export function buildLandingStructuredData(lp: LandingLike): object[] {
  const name = (lp.hero_title || lp.seo_title || "").trim();
  const location = asObject<LandingLocation>(lp.location);
  const footer = asObject<LandingFooter>(lp.footer);
  const hidden = resolveHiddenSections(lp.section_order);
  const services = hidden.includes("servicios") ? [] : asArray<ServiceItem>(lp.services);
  const faq = asArray<FaqItem>(lp.faq);
  const nodes: object[] = [];

  if (name) {
    const business: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name,
      url: lp.slug ? landingCanonicalUrl(lp.slug) : undefined,
    };
    const description = landingSeoDescription(lp);
    if (description) business.description = description;
    if (lp.hero_image_url) business.image = lp.hero_image_url;

    const showLocation = !!lp.location_enabled;
    const street = (showLocation ? location.address : null) || footer.address;
    const comuna = showLocation ? (location.comuna ?? "").trim() : "";
    const region = showLocation ? (location.region ?? "").trim() : "";
    if (street || comuna) {
      business.address = {
        "@type": "PostalAddress",
        ...(street ? { streetAddress: street } : {}),
        ...(comuna ? { addressLocality: comuna } : {}),
        ...(region ? { addressRegion: region } : {}),
        addressCountry: "CL",
      };
    }
    const comunas = showLocation ? (location.comunas ?? []).filter(Boolean) : [];
    if (comunas.length > 0) {
      business.areaServed = comunas.map((c) => ({ "@type": "City", name: c }));
    }

    const phone = landingPhone(lp);
    if (phone) business.telephone = phone;
    if (footer.email) business.email = footer.email;

    const sameAs = [footer.instagram, footer.facebook, footer.tiktok].filter(Boolean);
    if (sameAs.length > 0) business.sameAs = sameAs;

    if (showLocation) {
      const hours = (location.hours ?? []).filter(
        (h: OpeningHour) => !h.closed && h.from && h.to && SCHEMA_DAYS[h.day],
      );
      if (hours.length > 0) {
        business.openingHoursSpecification = hours.map((h: OpeningHour) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: `https://schema.org/${SCHEMA_DAYS[h.day]}`,
          opens: h.from,
          closes: h.to,
        }));
      }
    }

    const offers = services.filter((s) => s.title);
    if (offers.length > 0) {
      business.makesOffer = offers.map((s) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: s.title,
          ...(s.description ? { description: s.description } : {}),
        },
      }));
    }
    nodes.push(business);
  }

  if (lp.faq_enabled) {
    const questions = faq.filter((f) => f.question && f.answer);
    if (questions.length > 0) {
      nodes.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: questions.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      });
    }
  }
  return nodes;
}

/** JSON seguro para <script type="application/ld+json">. */
export function jsonLd(node: object): string {
  return JSON.stringify(node).replace(/</g, "\\u003c");
}
