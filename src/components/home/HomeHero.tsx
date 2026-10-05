import { Check, MapPin } from "lucide-react";
import { WhatsAppCta } from "./shared";
import { DiagnosticoLink } from "./GrowthSections";
import { translations } from "@/i18n/translations";

/** Entrance delay (ms) for each hero row: badge → title → subtitle → CTAs → trust. */
const delay = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

export function HomeHero() {
  const t = translations.es; // The public home is Spanish-only (Chile).
  const hero = t.home.hero;

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="aurora absolute -inset-[15%]" />
        <div className="blob absolute -top-24 -left-24 h-[340px] w-[340px] rounded-full bg-[color:var(--brand-1)]/25 md:h-[440px] md:w-[440px]" />
        <div
          className="blob absolute top-0 -right-24 h-[300px] w-[300px] rounded-full bg-[color:var(--brand-2)]/25 md:h-[400px] md:w-[400px]"
          style={{ animationDelay: "-5s" }}
        />
        <div
          className="blob absolute bottom-0 left-1/3 h-[260px] w-[260px] rounded-full bg-[color:var(--brand-3)]/20"
          style={{ animationDelay: "-9s" }}
        />
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-12 pb-14 text-center md:px-10 md:pt-24 md:pb-20">
        <p
          className="hero-in inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-foreground/80 backdrop-blur"
          style={delay(0)}
        >
          <MapPin aria-hidden className="h-3.5 w-3.5 text-[color:var(--brand-2)]" />
          {hero.badge}
        </p>
        <h1
          id="hero-title"
          style={delay(70)}
          className="hero-in mx-auto mt-6 max-w-4xl text-[2.1rem] font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl md:text-6xl"
        >
          {hero.titleLead}{" "}
          <span className="font-brand text-gradient-brand-strong text-shimmer">
            {hero.titleAccent}
          </span>
        </h1>
        <p
          className="hero-in mx-auto mt-5 max-w-2xl text-base text-muted-foreground text-pretty md:text-xl"
          style={delay(160)}
        >
          {hero.subtitle}
        </p>
        <p
          className="hero-in mt-4 text-sm font-semibold text-foreground md:text-base"
          style={delay(220)}
        >
          {hero.priceLine}
        </p>

        <div
          className="hero-in mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
          style={delay(280)}
        >
          <DiagnosticoLink />
          <a
            href="#planes"
            className="btn-fx inline-flex h-12 items-center justify-center rounded-full border border-foreground/15 bg-background px-7 text-base font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {hero.ctaSecondary}
          </a>
        </div>
        <p className="hero-in mt-4 flex justify-center" style={delay(330)}>
          <WhatsAppCta
            variant="outline"
            size="sm"
            className="border-transparent hover:border-foreground/15"
          >
            {hero.ctaPrimary}
          </WhatsAppCta>
        </p>

        <ul
          style={delay(380)}
          className="hero-in mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground"
        >
          {hero.trust.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <Check aria-hidden className="h-4 w-4 text-[color:var(--brand-1)]" /> {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
