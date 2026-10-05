import { DiagnosticoLink } from "@/components/home/GrowthSections";
import { WhatsAppCta } from "@/components/home/shared";
import type { ServiceContent } from "@/lib/services/content";
import { ServiceBreadcrumb } from "./ServiceHeader";
import { priceHeadline } from "./pricing";

export const EYEBROW_CLASS =
  "text-sm font-semibold uppercase tracking-widest text-[color:color-mix(in_oklab,var(--brand-2)_70%,black)] dark:text-[color:var(--brand-2)]";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

export function ServiceHero({ service }: { service: ServiceContent }) {
  return (
    <section
      aria-labelledby="servicio-titulo"
      className="mx-auto max-w-6xl px-4 pb-12 pt-6 md:px-10 md:pb-16 md:pt-8"
    >
      <ServiceBreadcrumb service={service} />
      <p className={`hero-in mt-8 ${EYEBROW_CLASS}`} style={delay(0)}>
        {service.eyebrow}
      </p>
      <h1
        id="servicio-titulo"
        style={delay(70)}
        className="hero-in mt-3 max-w-4xl text-[2rem] font-semibold leading-[1.1] tracking-tight text-balance md:text-5xl lg:text-6xl"
      >
        {service.h1Lead}{" "}
        <span className="font-brand text-gradient-brand-strong">{service.h1Accent}</span>
      </h1>
      <p
        className="hero-in mt-5 max-w-2xl text-base text-muted-foreground text-pretty md:text-lg"
        style={delay(160)}
      >
        {service.intro}
      </p>
      <p className="hero-in mt-5 text-base font-semibold" style={delay(220)}>
        {priceHeadline(service)}
      </p>
      <div className="hero-in mt-7 flex flex-col gap-3 sm:flex-row" style={delay(280)}>
        <DiagnosticoLink plan={service.diagnosticoPlan} />
        <WhatsAppCta variant="outline" message={service.whatsappMessage}>
          Cotiza por WhatsApp
        </WhatsAppCta>
      </div>
    </section>
  );
}
