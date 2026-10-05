import { ChevronDown } from "lucide-react";
import type { ServiceContent } from "@/lib/services/content";
import { SectionTitle } from "./ServiceSections";

/** FAQ con <details> nativo: las respuestas quedan en el HTML del SSR. */
export function ServiceFaqSection({ service }: { service: ServiceContent }) {
  return (
    <section aria-labelledby="faq-titulo" className="bg-secondary/50 py-14 md:py-20">
      <div className="mx-auto max-w-3xl px-4 md:px-10">
        <SectionTitle id="faq-titulo" eyebrow="Preguntas frecuentes">
          Lo que más nos preguntan
        </SectionTitle>
        <div className="divide-y rounded-2xl border bg-card">
          {service.faqs.map((f) => (
            <details key={f.q} className="group px-5 py-1">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-left font-semibold [&::-webkit-details-marker]:hidden">
                <span className="text-base">{f.q}</span>
                <ChevronDown
                  aria-hidden
                  className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pb-4 text-base text-muted-foreground text-pretty">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
