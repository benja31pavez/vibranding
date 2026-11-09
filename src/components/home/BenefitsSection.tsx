import { Search, ShoppingBag, Sparkles, ThumbsUp } from "lucide-react";
import { useTilt } from "@/hooks/use-tilt";
import { translations } from "@/i18n/translations";
import { SectionHeading } from "./shared";
import { BENEFIT_MOCKUPS } from "./mockups/BenefitMockups";

const BENEFIT_ICONS = [Search, ThumbsUp, ShoppingBag];
const TONES = ["var(--brand-1)", "var(--brand-2)", "var(--brand-3)"];

/**
 * "Tres pilares para que tu negocio venda": three numbered cards side by side
 * (stacked on mobile), each with its mockup. When a card scrolls into view (useScrollReveal
 * marks it `data-revealed`) it rises in and its mockup assembles; on desktop the three reveal
 * together, staggered, while the connector draws 1 → 2 → 3 (sections.css).
 * On hover a card behaves like the service tiles: tilt, gradient border, and its mockup comes
 * forward and assembles again.
 * Without JS, above the fold or with reduced motion everything is complete and static.
 */
export function BenefitsSection() {
  const b = translations.es.home.benefits; // The public home is Spanish-only (Chile).
  const tilt = useTilt();

  return (
    <section
      aria-labelledby="beneficios-title"
      className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-24"
    >
      <SectionHeading id="beneficios-title" title={b.title} accent={b.titleAccent} />
      <div className="relative mx-auto">
        {/* Siempre tres columnas en una fila; en teléfono las maquetas se ocultan y la letra baja. */}
        <ol className="bx-grid relative z-10 grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
          {b.items.map((item, i) => {
            const Icon = BENEFIT_ICONS[i] ?? Sparkles;
            const Mockup = BENEFIT_MOCKUPS[i];
            return (
              <li key={item.title} data-reveal className="bx-card flex flex-col">
                <span
                  aria-hidden
                  className="bx-pop mx-auto grid h-8 w-8 place-items-center rounded-full bg-gradient-brand-strong text-xs font-bold text-white shadow-lg ring-4 ring-background sm:h-11 sm:w-11 sm:text-sm"
                >
                  {i + 1}
                </span>
                <div
                  {...tilt}
                  className="svc bx-glow relative mt-3 flex flex-1 flex-col rounded-2xl border bg-card p-3 sm:mt-4 sm:rounded-3xl sm:p-5 md:p-6"
                >
                  <h3 className="flex flex-col items-start gap-1.5 text-sm font-semibold leading-tight sm:flex-row sm:items-center sm:gap-2.5 sm:text-xl">
                    <Icon
                      aria-hidden
                      className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
                      style={{ color: TONES[i] }}
                    />
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[11px] leading-snug text-muted-foreground sm:mt-3 sm:text-base sm:leading-relaxed">
                    {item.desc}
                  </p>
                  {Mockup && (
                    <div
                      aria-hidden
                      className="svc-mock mt-6 hidden flex-1 items-center justify-center lg:flex"
                    >
                      <Mockup />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {/* Connector between the badge centers (desktop); drawn when the grid reveals. */}
        <span
          aria-hidden
          className="bx-line absolute left-[calc((100%-3rem)/6)] right-[calc((100%-3rem)/6)] top-[21px] hidden h-0.5 overflow-hidden rounded-full bg-border lg:block"
        >
          <span className="block h-full w-full origin-left bg-gradient-brand-strong" />
        </span>
      </div>
    </section>
  );
}
