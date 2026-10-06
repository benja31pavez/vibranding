import { Info } from "lucide-react";
import { DiagnosticoLink } from "@/components/home/GrowthSections";
import { WhatsAppCta } from "@/components/home/shared";
import { PlanNotIncluded } from "@/components/pricing/PlanNotIncluded";
import { PLAN_SUMMARY, type ServiceContent } from "@/lib/services/content";
import { servicePlans } from "@/lib/services/seo";
import { formatClp } from "@/lib/site";
import { findAddon, type AddonKey } from "@/lib/pricing/addons";
import { planPeriod } from "./pricing";
import { SectionTitle } from "./ServiceSections";

function AddonPrice({
  addonKey,
  note,
  whatsappMessage,
}: {
  addonKey: AddonKey;
  note: string;
  whatsappMessage: string;
}) {
  const addon = findAddon(addonKey);
  if (!addon) return null;
  return (
    <div data-reveal className="max-w-xl rounded-3xl border bg-card p-6 md:p-8">
      <h3 className="text-lg font-semibold">{addon.label}</h3>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">{addon.setupLabel}</dt>
          <dd className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatClp(addon.setupNet)}
            <span className="text-base font-medium text-muted-foreground"> + IVA</span>
          </dd>
          <dd className="text-sm text-muted-foreground">pago único</dd>
        </div>
        {addon.monthlyNet > 0 && (
          <div>
            <dt className="text-sm text-muted-foreground">Mensualidad</dt>
            <dd className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatClp(addon.monthlyNet)}
              <span className="text-base font-medium text-muted-foreground"> + IVA</span>
            </dd>
            <dd className="text-sm text-muted-foreground">al mes, junto a tu plan</dd>
          </div>
        )}
      </dl>
      <p className="mt-4 text-base text-muted-foreground">{note}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <WhatsAppCta message={whatsappMessage} className="w-full sm:w-auto">
          Quiero el chatbot
        </WhatsAppCta>
      </div>
    </div>
  );
}

export function ServicePricingSection({ service }: { service: ServiceContent }) {
  const plans = servicePlans(service);
  return (
    <section aria-labelledby="precio-titulo" className="bg-secondary/50 py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-10">
        <SectionTitle id="precio-titulo" eyebrow="Precio">
          {plans.length > 1 ? "Planes y precios" : "Cuánto cuesta"}
        </SectionTitle>
        {service.pricing.kind === "addon" ? (
          <AddonPrice
            addonKey={service.pricing.addonKey}
            note={service.pricing.note}
            whatsappMessage={service.whatsappMessage}
          />
        ) : (
          <>
            <ul data-reveal-stagger className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => (
                <li key={plan.key} className="card-fx flex flex-col rounded-3xl border bg-card p-6">
                  <h3 className="text-lg font-semibold">{plan.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{PLAN_SUMMARY[plan.key]}</p>
                  <p className="mt-5 text-3xl font-semibold tracking-tight tabular-nums">
                    {formatClp(plan.netPrice)}
                    <span className="text-base font-medium text-muted-foreground"> + IVA</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{planPeriod(plan)}</p>
                  <PlanNotIncluded
                    items={plan.notIncluded}
                    className="mt-5 border-t border-border/60 pt-4"
                  />
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
