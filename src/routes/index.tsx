import { createFileRoute } from "@tanstack/react-router";
import { MARKETING_META, MARKETING_ORG_SCRIPT } from "@/lib/marketingSeo";
import { Landing } from "@/components/home/Landing";
import { translations } from "@/i18n/translations";
import { buildHomeJsonLd } from "@/lib/homeJsonLd";
import { SITE_URL } from "@/lib/site";
import { fetchPublicPortfolio } from "@/lib/portfolio";

const SEO = translations.es.seo.home;

export const Route = createFileRoute("/")({
  // Loaded on the server so portfolio logos and names are in the SSR HTML.
  loader: () => fetchPublicPortfolio(),
  head: () => ({
    meta: [
      ...MARKETING_META,
      { title: SEO.title },
      { name: "description", content: SEO.description },
      { property: "og:title", content: SEO.title },
      { property: "og:description", content: SEO.description },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:locale", content: "es_CL" },
      { name: "twitter:title", content: SEO.title },
      { name: "twitter:description", content: SEO.description },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [MARKETING_ORG_SCRIPT, { type: "application/ld+json", children: buildHomeJsonLd() }],
  }),
  component: HomeRoute,
});

function HomeRoute() {
  const portfolio = Route.useLoaderData();
  return <Landing portfolio={portfolio} />;
}
