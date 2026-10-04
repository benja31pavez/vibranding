import { translations } from "@/i18n/translations";
import { LEGAL_NAME, LEGAL_RUT, SITE_URL, WHATSAPP_E164 } from "@/lib/site";

/** Comunas of Santiago we actively serve (plus the rest of Chile via the Country entry). */
const SANTIAGO_COMUNAS = [
  "Santiago", "Providencia", "Las Condes", "Vitacura", "Lo Barnechea", "Ñuñoa", "La Reina",
  "Peñalolén", "Macul", "La Florida", "Puente Alto", "Maipú", "San Miguel", "Huechuraba", "Colina",
];

/** Structured data for the home page: business, offer catalog and FAQ. */
export function buildHomeJsonLd(): string {
  const es = translations.es;
  const businessId = `${SITE_URL}/#business`;

  const offers = es.home.plans.items.map((plan) => ({
    "@type": "Offer",
    name: plan.name,
    description: [plan.desc, ...plan.features].join(" · "),
    url: `${SITE_URL}/#planes`,
    priceCurrency: "CLP",
    price: plan.price,
    priceSpecification: {
      "@type": plan.period === "al mes" ? "UnitPriceSpecification" : "PriceSpecification",
      price: plan.price,
      priceCurrency: "CLP",
      valueAddedTaxIncluded: true,
      ...(plan.period === "al mes" ? { unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } } : {}),
    },
    areaServed: { "@type": "Country", name: "Chile" },
    seller: { "@id": businessId },
  }));

  const graph = [
    {
      "@type": "ProfessionalService",
      "@id": businessId,
      name: "Vibranding",
      legalName: LEGAL_NAME,
      taxID: LEGAL_RUT,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/favicon.ico`,
      description: es.seo.home.description,
      telephone: WHATSAPP_E164,
      priceRange: "$129.990 - $249.990 CLP",
      currenciesAccepted: "CLP",
      paymentAccepted: "Transferencia bancaria, link de pago",
      founder: { "@type": "Person", name: "Benjamín Pavez" },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Santiago",
        addressRegion: "Región Metropolitana",
        addressCountry: "CL",
      },
      areaServed: [
        { "@type": "Country", name: "Chile" },
        ...SANTIAGO_COMUNAS.map((name) => ({ "@type": "City", name })),
      ],
      knowsAbout: ["Branding", "Marketing de contenidos", "Meta Ads", "Google Ads", "Google Business Profile", "Landing pages"],
      contactPoint: {
        "@type": "ContactPoint",
        telephone: WHATSAPP_E164,
        contactType: "sales",
        areaServed: "CL",
        availableLanguage: "es",
      },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Planes de marketing digital para pymes",
        itemListElement: offers,
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: es.faq.items.map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a },
      })),
    },
  ];

  // Escape "<" so the JSON can never close the surrounding <script> tag.
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}
