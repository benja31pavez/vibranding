import { Info } from "lucide-react";
import { DiagnosticoLink } from "@/components/home/GrowthSections";
import { WhatsAppCta } from "@/components/home/shared";
import { PLAN_SUMMARY, type ServiceContent } from "@/lib/services/content";
import { servicePlans } from "@/lib/services/seo";
import { formatClp } from "@/lib/site";
import { planPeriod } from "./pricing";
import { SectionTitle } from "./ServiceSections";

export function ServicePricingSection({ service }: { service: ServiceContent }) {
  const plans = servicePlans(service);
  return (
    <section aria-labelledby="precio-titulo" className="bg-secondary/50 py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-10">
        <SectionTitle id="precio-titulo" eyebrow="Precio">
          {plans.length > 1 ? "Planes y precios" : "Cuánto cuesta"}
        </SectionTitle>
        {service.pricing.kind === "quote" ? (
          <div className="max-w-xl rounded-3xl border bg-card p-6 md:p-8">
            <p className="text-3xl font-semibold tracking-tight">{service.pricing.label}</p>
            <p className="mt-3 text-base text-muted-foreground">{service.pricing.note}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <WhatsAppCta message={service.whatsappMessage} className="w-full sm:w-auto">
                Pedir cotización
              </WhatsAppCta>
            </div>
          </div>
        ) : (
          <>
            <ul className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => (
                <li key={plan.key} className="flex flex-col rounded-3xl border bg-card p-6">
                  <h3 className="text-lg font-semibold">{plan.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{PLAN_SUMMARY[plan.key]}</p>
                  <p className="mt-5 text-3xl font-semibold tracking-tight tabular-nums">
                    {formatClp(plan.price)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {planPeriod(plan)} · IVA incluido
                  </p>
                  <div className="mt-auto pt-6">
                    <DiagnosticoLink plan={plan.key} variant="outline" className="w-full">
                      Quiero este plan
                    </DiagnosticoLink>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 flex max-w-3xl items-start gap-2 text-sm text-muted-foreground">
              <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{service.pricing.note} No prometemos resultados garantizados.</span>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
