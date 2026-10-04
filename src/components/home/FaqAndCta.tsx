import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, MessageCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { trackLandingEvent } from "@/lib/track";
import { whatsappUrl } from "@/lib/site";
import { SectionHeading, WhatsAppCta } from "./shared";

/** Native <details> keeps every answer in the server-rendered HTML (good for SEO and no-JS). */
export function FaqSection() {
  const { t } = useLang();
  const copy = t.home.faq;
  return (
    <section id="preguntas" aria-labelledby="preguntas-title" className="scroll-mt-20 bg-secondary/50 py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 md:px-10">
        <SectionHeading id="preguntas-title" title={copy.title} accent={copy.titleAccent} />
        <div className="divide-y rounded-3xl border bg-card">
          {t.faq.items.map((item) => (
            <details key={item.q} className="group px-5 md:px-7">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 -mt-1 text-muted-foreground leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-sm">
          <Link to="/faq" className="font-medium underline underline-offset-4 hover:text-[color:var(--brand-2)]">
            {copy.more}
          </Link>
        </p>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  const { t } = useLang();
  const c = t.home.finalCta;
  return (
    <section id="contacto" aria-labelledby="contacto-title" className="scroll-mt-20 px-4 py-16 md:px-10 md:py-24">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-[oklch(0.22_0.05_268)] px-6 py-14 text-center text-white md:px-12 md:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60">
          <div className="blob absolute -top-20 -left-10 h-72 w-72 rounded-full bg-[color:var(--brand-1)]/50" />
          <div className="blob absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-[color:var(--brand-2)]/50" style={{ animationDelay: "-6s" }} />
        </div>
        <div className="relative">
          <h2 id="contacto-title" className="text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            {c.title} <span className="font-brand">{c.titleAccent}</span>
            {c.titleEnd}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/85 md:text-lg">{c.subtitle}</p>
          <div className="mt-8 flex justify-center">
            <WhatsAppCta variant="light">{c.cta}</WhatsAppCta>
          </div>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/85">
            {c.bullets.map((b) => (
              <li key={b} className="inline-flex items-center gap-1.5">
                <Check aria-hidden className="h-4 w-4" /> {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Fixed WhatsApp button, always reachable on mobile. */
export function WhatsAppFloat() {
  const { t, lang } = useLang();
  return (
    <a
      href={whatsappUrl()}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackLandingEvent("whatsapp_click", lang)}
      aria-label={t.home.floatLabel}
      className="fixed bottom-4 right-4 z-50 inline-flex h-14 items-center gap-2 rounded-full bg-[#128C7E] px-4 text-white shadow-lg shadow-black/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:bottom-6 md:right-6"
    >
      <MessageCircle aria-hidden className="h-6 w-6" />
      <span className="hidden text-sm font-semibold md:inline">WhatsApp</span>
    </a>
  );
}
