/**
 * Metadatos de marca de Vibranding (og:image, JSON-LD Organization/WebSite).
 * Sólo para las páginas de marketing: las landings y multienlaces de clientes
 * definen los suyos y no deben heredar la identidad de la agencia.
 */
import { LEGAL_NAME, ORGANIZATION_ID, SITE_URL, WHATSAPP_E164 } from "@/lib/site";

const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const MARKETING_META = [
  { property: "og:image", content: OG_IMAGE },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  {
    property: "og:image:alt",
    content: "Vibranding: marketing digital para pymes chilenas que quieren más clientes",
  },
  { name: "twitter:image", content: OG_IMAGE },
  { name: "twitter:card", content: "summary_large_image" },
  { property: "og:type", content: "website" },
  { property: "og:site_name", content: "Vibranding" },
];

export const MARKETING_ORG_SCRIPT = {
  type: "application/ld+json",
  children: JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "Vibranding",
        legalName: LEGAL_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        telephone: WHATSAPP_E164,
        address: { "@type": "PostalAddress", addressLocality: "Santiago", addressCountry: "CL" },
      },
      {
        "@type": "WebSite",
        name: "Vibranding",
        url: SITE_URL,
        inLanguage: "es-CL",
      },
    ],
  }),
};
