import { Search, ShoppingBag, Sparkles, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollSteps } from "@/hooks/use-scroll-steps";
import { translations } from "@/i18n/translations";
import { SectionHeading } from "./shared";
import { BENEFIT_MOCKUPS } from "./mockups/BenefitMockups";

const BENEFIT_ICONS = [Search, ThumbsUp, ShoppingBag];
const TONES = ["var(--brand-1)", "var(--brand-2)", "var(--brand-3)"];

/** Data attributes that drive the mockup assembly (see sections.css). */
function playState(ready: boolean, playing: boolean): Record<string, string | undefined> {
  if (!ready) return {};
  return playing ? { "data-bx-play": "" } : { "data-bx-armed": "" };
}

/**
 * "Tres cosas que tu negocio necesita en internet". Desktop with motion: steps on a numbered
 * rail light up one by one while a sticky stage assembles each step's mockup. Mobile and
 * reduced motion: the mockup sits under each step (assembled once on mobile, static otherwise).
 * Without JS everything is visible and complete.
 */
export function BenefitsSection() {
  const b = translations.es.home.benefits; // The public home is Spanish-only (Chile).
  const { listRef, ready, active, played } = useScrollSteps(b.items.length);
  const progress = ready ? active / Math.max(b.items.length - 1, 1) : 1;

  return (
    <section
      aria-labelledby="beneficios-title"
      className="mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-24"
    >
      <SectionHeading id="beneficios-title" title={b.title} accent={b.titleAccent} />
      <div className="grid gap-10 lg:motion-safe:grid-cols-2 lg:motion-safe:gap-16">
        <ol ref={listRef} className="relative space-y-8 lg:motion-safe:space-y-0">
          <span
            aria-hidden
            className="absolute bottom-6 left-[21px] top-6 w-0.5 rounded-full bg-border lg:motion-safe:bottom-[25vh] lg:motion-safe:top-[25vh]"
          >
            <span
              className="block h-full w-full origin-top rounded-full bg-gradient-brand-strong motion-safe:transition-transform motion-safe:duration-700"
              style={{ transform: `scaleY(${progress})` }}
            />
          </span>
          {b.items.map((item, i) => {
            const Icon = BENEFIT_ICONS[i] ?? Sparkles;
            const Mockup = BENEFIT_MOCKUPS[i];
            const isOn = ready && i === active;
            const isReached = !ready || i <= active;
            return (
              <li
                key={item.title}
                className="relative pl-16 lg:motion-safe:flex lg:motion-safe:min-h-[50vh] lg:motion-safe:items-center lg:motion-reduce:grid lg:motion-reduce:grid-cols-2 lg:motion-reduce:items-center lg:motion-reduce:gap-10"
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-5 z-10 grid h-11 w-11 place-items-center rounded-full border-2 text-sm font-bold transition-colors duration-500 lg:motion-safe:top-1/2 lg:motion-safe:-mt-[22px]",
                    isReached
                      ? "border-transparent bg-gradient-brand-strong text-white"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <div
                  data-on={isOn ? "" : undefined}
                  className={cn(
                    "bx-glow relative w-full rounded-3xl border bg-card p-6 transition-opacity duration-500 md:p-7",
                    ready && !isOn && "lg:opacity-45",
                  )}
                >
                  <h3 className="flex items-center gap-2.5 text-xl font-semibold">
                    <Icon aria-hidden className="h-5 w-5" style={{ color: TONES[i] }} />
                    {item.title}
                  </h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
                {Mockup && (
                  <div
                    aria-hidden
                    {...playState(ready, played[i] ?? false)}
                    className="mt-5 flex justify-center lg:motion-safe:hidden lg:motion-reduce:mt-0"
                  >
                    <Mockup />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <div aria-hidden className="hidden lg:motion-safe:block">
          <div className="sticky top-[calc(50vh-200px)] grid h-[400px] place-items-center">
            {BENEFIT_MOCKUPS.map((Mockup, i) => (
              <div
                key={i}
                {...(ready && i === active ? { "data-bx-play": "" } : {})}
                className={cn(
                  "flex w-full justify-center transition-[opacity,transform] duration-500 [grid-area:1/1]",
                  i === active
                    ? "opacity-100"
                    : "pointer-events-none translate-y-3 scale-[0.97] opacity-0",
                )}
              >
                <Mockup />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
