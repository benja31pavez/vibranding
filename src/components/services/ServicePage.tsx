import { SiteFooter } from "@/components/SiteFooter";
import type { ServiceContent } from "@/lib/services/content";
import { ServiceFaqSection } from "./ServiceFaq";
import { ServiceHeader } from "./ServiceHeader";
import { ServiceHero } from "./ServiceHero";
import { RelatedServices, ServiceFinalCta } from "./ServiceLinks";
import { ServicePricingSection } from "./ServicePricing";
import { IncludesSection, ProblemSolutionSection, ProcessSection } from "./ServiceSections";

/** Página pública de servicio (SEO local): problema → solución → precio → proceso → FAQ → CTA. */
export function ServicePage({ service }: { service: ServiceContent }) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
      >
        Saltar al contenido
      </a>
      <ServiceHeader service={service} />
      <main id="contenido" className="flex-1">
        <ServiceHero service={service} />
        <ProblemSolutionSection service={service} />
        <IncludesSection service={service} />
        <ServicePricingSection service={service} />
        <ProcessSection service={service} />
        <ServiceFaqSection service={service} />
        <RelatedServices service={service} />
        <ServiceFinalCta service={service} />
      </main>
      <SiteFooter />
    </div>
  );
}
