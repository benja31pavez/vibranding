import { DiagnosticoLink } from "@/components/home/GrowthSections";
import { WhatsAppCta } from "@/components/home/shared";
import type { ServiceContent } from "@/lib/services/content";
import { PhotoSlot } from "@/components/home/mockups/PhotoSlot";
import { SERVICE_HERO_PHOTOS } from "@/components/home/mockups/photo-slots";
import { ServiceMockup } from "@/components/home/mockups/ServiceMockups";
import { ServiceBreadcrumb } from "./ServiceHeader";
import { priceHeadline } from "./pricing";

export const EYEBROW_CLASS =
  "text-sm font-semibold uppercase tracking-widest text-[color:color-mix(in_oklab,var(--brand-2)_70%,black)] dark:text-[color:var(--brand-2)]";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

export function ServiceHero({ service }: { service: ServiceContent }) {
  const heroPhoto = SERVICE_HERO_PHOTOS[service.slug];
  return (
    <section
      aria-labelledby="servicio-titulo"
      className="mx-auto max-w-6xl px-4 pb-12 pt-6 md:px-10 md:pb-16 md:pt-8"
    >
      <ServiceBreadcrumb service={service} />
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <div>
          <p className={`hero-in mt-8 ${EYEBROW_CLASS}`} style={delay(0)}>
            {service.eyebrow}
          </p>
          <h1
            id="servicio-titulo"
            style={delay(70)}
            className="hero-in mt-3 max-w-4xl text-[2rem] font-semibold leading-[1.1] tracking-tight text-balance md:text-5xl lg:text-[3.4rem]"
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
        </div>
        <div className="hero-in lg:mt-8" style={delay(300)}>
          <PhotoSlot
            images={heroPhoto ? [heroPhoto] : []}
            sizes="360px"
            className="mx-auto grid aspect-[4/5] w-full max-w-[360px] place-items-center rounded-[2rem] p-5"
          >
            <div aria-hidden className="relative flex w-full justify-center">
              <ServiceMockup slug={service.slug} />
            </div>
          </PhotoSlot>
        </div>
      </div>
    </section>
  );
}
