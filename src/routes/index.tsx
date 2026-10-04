import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { SiteFooter } from "@/components/SiteFooter";
import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeHero } from "@/components/home/HomeHero";
import {
  BenefitsSection, GuaranteeSection, HowWeWorkSection, ServicesSection,
} from "@/components/home/HomeSections";
import { PlansSection } from "@/components/home/PlansSection";
import { AboutSection } from "@/components/home/AboutSection";
import { PortfolioSection } from "@/components/home/PortfolioSection";
import { FaqSection, FinalCtaSection, WhatsAppFloat } from "@/components/home/FaqAndCta";
import { translations } from "@/i18n/translations";
import { buildHomeJsonLd } from "@/lib/homeJsonLd";
import { SITE_URL } from "@/lib/site";
import { fetchPublicPortfolio, type PortfolioClientWithWorks } from "@/lib/portfolio";

const SEO = translations.es.seo.home;

export const Route = createFileRoute("/")({
  // Loaded on the server so portfolio logos and names are in the SSR HTML.
  loader: () => fetchPublicPortfolio(),
  head: () => ({
    meta: [
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
    scripts: [{ type: "application/ld+json", children: buildHomeJsonLd() }],
  }),
  component: HomeRoute,
});

function HomeRoute() {
  const portfolio = Route.useLoaderData();
  return <Landing portfolio={portfolio} />;
}

/**
 * Public agency home. Always rendered (also on the server) so crawlers get the
 * full content; signed-in users are sent to the dashboard on the client only.
 */
export function Landing({
  forcePublic = false,
  portfolio,
}: {
  forcePublic?: boolean;
  portfolio: PortfolioClientWithWorks[];
}) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (forcePublic || loading || !session) return;
    void navigate({ to: "/dashboard", replace: true });
  }, [forcePublic, loading, session, navigate]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
      >
        Saltar al contenido
      </a>
      <HomeHeader />
      <main id="contenido">
        <HomeHero />
        <BenefitsSection />
        <ServicesSection />
        <PlansSection />
        <GuaranteeSection />
        <HowWeWorkSection />
        <AboutSection />
        <PortfolioSection portfolio={portfolio} />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <SiteFooter />
      <WhatsAppFloat />
    </div>
  );
}
