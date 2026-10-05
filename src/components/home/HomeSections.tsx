import {
  Bot, Camera, Megaphone, MonitorSmartphone, Palette, Search, ShoppingBag, Sparkles, ThumbsUp,
} from "lucide-react";
import { SectionHeading } from "./shared";
import { translations } from "@/i18n/translations";

const BENEFIT_ICONS = [Search, ThumbsUp, ShoppingBag];
const SERVICE_ICONS = [Palette, Camera, Megaphone, Search];
const TONES = ["var(--brand-1)", "var(--brand-2)", "var(--brand-3)", "var(--brand-1)"];

export function BenefitsSection() {
  const t = translations.es; // The public home is Spanish-only (Chile).
  const b = t.home.benefits;
  return (
    <section aria-labelledby="beneficios-title" className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-24">
      <SectionHeading id="beneficios-title" title={b.title} accent={b.titleAccent} />
      <ol className="grid gap-5 md:grid-cols-3">
        {b.items.map((item, i) => {
          const Icon = BENEFIT_ICONS[i] ?? Sparkles;
          return (
            <li key={item.title} className="rounded-3xl border bg-card p-6 md:p-7">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-11 w-11 place-items-center rounded-2xl text-white"
                  style={{ background: `linear-gradient(135deg, ${TONES[i]}, color-mix(in oklab, ${TONES[i]} 60%, black))` }}
                >
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-semibold">{item.title}</h3>
              </div>
              <p className="mt-4 text-muted-foreground leading-relaxed">{item.desc}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function ServicesSection() {
  const t = translations.es; // The public home is Spanish-only (Chile).
  const s = t.home.services;
  return (
    <section id="servicios" aria-labelledby="servicios-title" className="scroll-mt-20 bg-secondary/50 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-10">
        <SectionHeading id="servicios-title" title={s.title} accent={s.titleAccent} subtitle={s.subtitle} />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {s.items.map((item, i) => {
            const Icon = SERVICE_ICONS[i] ?? Sparkles;
            return (
              <li key={item.title} className="flex flex-col rounded-3xl border bg-card p-6">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary">
                  <Icon aria-hidden className="h-5 w-5" style={{ color: TONES[i] }} />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </li>
            );
          })}
        </ul>
        <p className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-dashed bg-background/70 p-4 text-sm text-foreground/80">
          <span className="flex shrink-0 gap-1 pt-0.5" aria-hidden>
            <MonitorSmartphone className="h-4 w-4 text-[color:var(--brand-1)]" />
            <Bot className="h-4 w-4 text-[color:var(--brand-2)]" />
          </span>
          {s.extras}
        </p>
      </div>
    </section>
  );
}
