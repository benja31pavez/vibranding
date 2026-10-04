import { Check, Dumbbell, HeartPulse, Home as HomeIcon, MapPin } from "lucide-react";
import { WhatsAppCta } from "./shared";
import { translations } from "@/i18n/translations";

const NICHE_ICONS = [HomeIcon, HeartPulse, Dumbbell];

export function HomeHero() {
  const t = translations.es; // The public home is Spanish-only (Chile).
  const hero = t.home.hero;

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
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
        <p className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-foreground/80 backdrop-blur">
          <MapPin aria-hidden className="h-3.5 w-3.5 text-[color:var(--brand-2)]" />
          {hero.badge}
        </p>
        <h1
          id="hero-title"
          className="mx-auto mt-6 max-w-4xl text-[2.1rem] font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl md:text-6xl"
        >
          {hero.titleLead}{" "}
          <span className="font-brand text-gradient-brand-strong">{hero.titleAccent}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground text-pretty md:text-xl">{hero.subtitle}</p>
        <p className="mt-4 text-sm font-semibold text-foreground md:text-base">{hero.priceLine}</p>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <WhatsAppCta>{hero.ctaPrimary}</WhatsAppCta>
          <a
            href="#planes"
            className="inline-flex h-12 items-center justify-center rounded-full border border-foreground/15 bg-background px-7 text-base font-semibold hover:bg-secondary"
          >
            {hero.ctaSecondary}
          </a>
        </div>

        <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {hero.trust.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <Check aria-hidden className="h-4 w-4 text-[color:var(--brand-1)]" /> {item}
            </li>
          ))}
        </ul>
      </div>

      <NichesStrip />
    </section>
  );
}

function NichesStrip() {
  const t = translations.es; // The public home is Spanish-only (Chile).
  const niches = t.home.niches;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 md:px-10 md:pb-20">
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {niches.title}
      </p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {niches.items.map((n, i) => {
          const Icon = NICHE_ICONS[i] ?? HomeIcon;
          return (
            <li key={n.title} className="flex items-start gap-3 rounded-2xl border bg-card/80 p-4 backdrop-blur">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary">
                <Icon aria-hidden className="h-5 w-5 text-[color:var(--brand-1)]" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{n.title}</span>
                <span className="block text-sm text-muted-foreground">{n.desc}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-center text-sm text-muted-foreground">{niches.coverage}</p>
    </div>
  );
}
