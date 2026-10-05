import { Check, Info } from "lucide-react";
import { formatClp } from "@/lib/site";
import { cn } from "@/lib/utils";
import { SectionHeading, WhatsAppCta } from "./shared";
import { DiagnosticoLink } from "./GrowthSections";
import { translations, type PlanItem } from "@/i18n/translations";

export function PlansSection() {
  const t = translations.es; // The public home is Spanish-only (Chile).
  const p = t.home.plans;
  return (
    <section id="planes" aria-labelledby="planes-title" className="scroll-mt-20 bg-secondary/50 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-10">
        <SectionHeading id="planes-title" title={p.title} accent={p.titleAccent} subtitle={p.subtitle} />
        <ul className="grid items-stretch gap-6 lg:grid-cols-3">
          {p.items.map((plan) => (
            <PlanCard key={plan.id} plan={plan} popularLabel={p.popular} ctaLabel={p.cta} />
          ))}
        </ul>
        <p className="mx-auto mt-8 flex max-w-3xl items-start gap-2 text-sm text-muted-foreground">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {p.adSpendNote}
        </p>
      </div>
    </section>
  );
}

function PlanCard({ plan, popularLabel, ctaLabel }: { plan: PlanItem; popularLabel: string; ctaLabel: string }) {
  return (
    <li
      className={cn(
        "relative flex flex-col rounded-3xl bg-card p-6 md:p-8",
        plan.highlighted
          ? "border-2 border-[color:var(--brand-2)] shadow-xl shadow-[color:var(--brand-2)]/15"
          : "border",
      )}
    >
      {plan.highlighted && (
        <span className="absolute -top-3 left-6 rounded-full bg-gradient-brand-strong px-3 py-1 text-xs font-semibold text-white">
          {popularLabel}
        </span>
      )}
      <h3 className="text-xl font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>
      <p className="mt-6 flex flex-wrap items-baseline gap-x-2">
        <span className="text-4xl font-semibold tracking-tight">{formatClp(plan.price)}</span>
        <span className="text-sm text-muted-foreground">{plan.period}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">IVA incluido · {plan.terms}</p>
      <ul className="mt-6 space-y-3 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-1)]" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        <WhatsAppCta
          message={plan.whatsappMessage}
          variant={plan.highlighted ? "primary" : "outline"}
          className="w-full"
        >
          {ctaLabel}
          <span className="sr-only">: {plan.name}</span>
        </WhatsAppCta>
        <DiagnosticoLink plan={plan.id} variant="outline" size="sm" className="mt-3 w-full border-transparent hover:border-foreground/15">
          Agenda un diagnóstico
          <span className="sr-only"> gratis para {plan.name}</span>
        </DiagnosticoLink>
      </div>
    </li>
  );
}
