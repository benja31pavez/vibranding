import { findPlan, type Plan } from "@/lib/pricing/plans";
import { ORGANIZATION_ID, SITE_URL } from "@/lib/site";
import { MARKETING_META, MARKETING_ORG_SCRIPT } from "@/lib/marketingSeo";
import { PLAN_SUMMARY, type ServiceContent } from "./content";

export function serviceUrl(service: ServiceContent): string {
  return `${SITE_URL}${service.path}`;
}

/** Planes de plans.ts que muestra la página (en el orden del contenido). */
export function servicePlans(service: ServiceContent): Plan[] {
  if (service.pricing.kind !== "plans") return [];
  return service.pricing.planKeys.map((key) => findPlan(key)).filter((p): p is Plan => p !== null);
}

function buildOffers(service: ServiceContent, url: string) {
  return servicePlans(service).map((plan) => {
    const monthly = plan.billing === "monthly";
    return {
      "@type": "Offer",
      name: plan.label,
      description: PLAN_SUMMARY[plan.key],
      url,
      price: plan.price,
      priceCurrency: "CLP",
      priceSpecification: {
        "@type": monthly ? "UnitPriceSpecification" : "PriceSpecification",
        price: plan.price,
        priceCurrency: "CLP",
        valueAddedTaxIncluded: true,
        ...(monthly ? { unitCode: "MON" } : {}),
      },
      areaServed: { "@type": "Country", name: "Chile" },
      seller: { "@id": ORGANIZATION_ID },
    };
  });
}

/** JSON-LD (Service + FAQPage + BreadcrumbList) escapado para un <script>. */
export function buildServiceJsonLd(service: ServiceContent): string {
  const url = serviceUrl(service);
  const offers = buildOffers(service, url);
  const graph = [
    {
      "@type": "Service",
      "@id": `${url}#service`,
      name: service.serviceName,
      serviceType: service.serviceType,
      description: service.description,
      url,
      provider: { "@id": ORGANIZATION_ID },
      areaServed: [
        { "@type": "City", name: "Santiago" },
        { "@type": "Country", name: "Chile" },
      ],
      availableLanguage: "es",
      ...(offers.length > 0 ? { offers } : {}),
    },
    {
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: service.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: service.serviceName, item: url },
      ],
    },
  ];
  // Escape "<" so the JSON can never close the surrounding <script> tag.
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(
    /</g,
    "\\u003c",
  );
}

/** `head()` de TanStack Router para una página de servicio. */
export function buildServiceHead(service: ServiceContent) {
  const url = serviceUrl(service);
  return {
    meta: [
      { title: service.title },
      { name: "description", content: service.description },
      ...MARKETING_META,
      { property: "og:title", content: service.title },
      { property: "og:description", content: service.description },
      { property: "og:url", content: url },
      { property: "og:locale", content: "es_CL" },
      { name: "twitter:title", content: service.title },
      { name: "twitter:description", content: service.description },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      MARKETING_ORG_SCRIPT,
      { type: "application/ld+json", children: buildServiceJsonLd(service) },
    ],
  };
}
