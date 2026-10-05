import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { SiteFooter } from "@/components/SiteFooter";
import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeHero } from "@/components/home/HomeHero";
import { BenefitsSection } from "@/components/home/BenefitsSection";
import { ServicesSection } from "@/components/home/ServicesSection";
import { ForWhomSection, WorkWithUsSection } from "@/components/home/GrowthSections";
import { PlansSection } from "@/components/home/PlansSection";
import { AboutSection } from "@/components/home/AboutSection";
import { PortfolioSection } from "@/components/home/PortfolioSection";
import { FaqSection, FinalCtaSection, WhatsAppFloat } from "@/components/home/FaqAndCta";
import type { PortfolioClientWithWorks } from "@/lib/portfolio";
import { useScrollReveal } from "@/hooks/use-motion";

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
  useScrollReveal();

  useEffect(() => {
    if (forcePublic || loading || !session) return;
    void navigate({ to: "/dashboard", replace: true });
  }, [forcePublic, loading, session, navigate]);

  return (
    <div data-smooth-scroll className="min-h-screen overflow-x-clip bg-background text-foreground">
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
        <ForWhomSection />
        <ServicesSection />
        <PlansSection />
        <WorkWithUsSection />
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
