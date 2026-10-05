/**
 * Metadatos de marca de Vibranding (og:image, JSON-LD Organization/WebSite).
 * Sólo para las páginas de marketing: las landings y multienlaces de clientes
 * definen los suyos y no deben heredar la identidad de la agencia.
 */
import { LEGAL_NAME, ORGANIZATION_ID, SITE_URL, WHATSAPP_E164 } from "@/lib/site";

const OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2930eeea-27b9-495c-932b-005c7b79e815/id-preview-f7ff2cc0--e7caaa14-14c5-42d8-b5b5-4cde48ca5360.lovable.app-1779051473659.png";

export const MARKETING_META = [
  { property: "og:image", content: OG_IMAGE },
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
        // TODO: reemplazar por un logo PNG cuadrado de al menos 112x112 px (p. ej. public/logo.png).
        logo: `${SITE_URL}/favicon.ico`,
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
