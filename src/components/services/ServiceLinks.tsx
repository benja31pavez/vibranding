import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { DiagnosticoLink } from "@/components/home/GrowthSections";
import { WhatsAppCta } from "@/components/home/shared";
import { SERVICES, type ServiceContent } from "@/lib/services/content";
import { SectionTitle } from "./ServiceSections";

export function RelatedServices({ service }: { service: ServiceContent }) {
  return (
    <section aria-labelledby="relacionados-titulo" className="py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-10">
        <SectionTitle id="relacionados-titulo" eyebrow="Otros servicios">
          También te puede servir
        </SectionTitle>
        <ul className="grid gap-4 md:grid-cols-3">
          {service.related.map((slug) => {
            const other = SERVICES[slug];
            return (
              <li key={slug}>
                <Link
                  to={other.path}
                  className="group flex h-full flex-col rounded-2xl border bg-card p-5 transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-lg font-semibold">{other.navLabel}</span>
                  <span className="mt-2 text-sm text-muted-foreground">{other.eyebrow}</span>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
                    Ver servicio{" "}
                    <ArrowRight
                      aria-hidden
                      className="h-4 w-4 transition group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-8 text-base">
          <Link to="/" className="font-semibold underline underline-offset-4 hover:no-underline">
            Ver todos los planes y servicios de Vibranding
          </Link>
        </p>
      </div>
    </section>
  );
}

export function ServiceFinalCta({ service }: { service: ServiceContent }) {
  return (
    <section aria-labelledby="cta-titulo" className="px-4 pb-16 md:px-10 md:pb-24">
      <div className="mx-auto max-w-6xl rounded-3xl bg-gradient-brand-strong px-6 py-12 text-center text-white md:px-12 md:py-16">
        <h2
          id="cta-titulo"
          className="mx-auto max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-balance md:text-4xl"
        >
          ¿Partimos con un diagnóstico gratis?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-white/90">
          Cuéntanos de tu negocio en 1 minuto y te decimos qué haríamos primero. Sin compromiso.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <DiagnosticoLink plan={service.diagnosticoPlan} variant="onDark" />
          <WhatsAppCta variant="light" message={service.whatsappMessage}>
            Escríbenos por WhatsApp
          </WhatsAppCta>
        </div>
      </div>
    </section>
  );
}
