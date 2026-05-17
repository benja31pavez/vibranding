import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLang } from "@/i18n/LanguageContext";
import { translations } from "@/i18n/translations";
import {
  Instagram, Megaphone, BarChart3, ArrowRight, Check,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: translations.es.seo.home.title },
      { name: "description", content: translations.es.seo.home.description },
      { property: "og:title", content: translations.es.seo.home.title },
      { property: "og:description", content: translations.es.seo.home.description },
      { property: "og:url", content: "https://vibranding.pro/" },
    ],
    links: [{ rel: "canonical", href: "https://vibranding.pro/" }],
  }),
  component: Landing,
});

export function Landing({ forcePublic = false }: { forcePublic?: boolean } = {}) {
  const { session, loading } = useAuth();
  const { t } = useLang();
  const blob1 = useRef<HTMLDivElement>(null);
  const blob2 = useRef<HTMLDivElement>(null);
  const blob3 = useRef<HTMLDivElement>(null);
  const heroContent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (blob1.current) blob1.current.style.transform = `translate3d(${y * 0.05}px, ${y * 0.25}px, 0)`;
        if (blob2.current) blob2.current.style.transform = `translate3d(${y * -0.08}px, ${y * 0.18}px, 0)`;
        if (blob3.current) blob3.current.style.transform = `translate3d(${y * 0.04}px, ${y * 0.4}px, 0)`;
        if (heroContent.current) {
          heroContent.current.style.transform = `translate3d(0, ${y * 0.12}px, 0)`;
          heroContent.current.style.opacity = String(Math.max(0, 1 - y / 700));
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (loading) return <div className="min-h-screen" />;
  if (session && !forcePublic) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between max-w-7xl mx-auto relative z-10">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-3xl md:text-4xl font-bold italic tracking-tight text-gradient-brand bg-gradient-brand-animated">Vibranding</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <a href="#servicios" className="text-muted-foreground hover:text-foreground story-link">{t.nav.services}</a>
          <a href="#como" className="text-muted-foreground hover:text-foreground story-link">{t.nav.how}</a>
          <a href="#contacto" className="text-muted-foreground hover:text-foreground story-link">{t.nav.contact}</a>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">{t.nav.signIn}</Link>
        </div>
      </header>

      <main>
      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-6 md:px-10 pt-12 md:pt-24 pb-20 md:pb-32 text-center">
        {/* Animated background blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div ref={blob1} className="blob absolute -top-20 -left-10 w-[420px] h-[420px] rounded-full bg-[color:var(--brand-1)]/40 will-change-transform" />
          <div ref={blob2} className="blob absolute top-10 right-0 w-[380px] h-[380px] rounded-full bg-[color:var(--brand-2)]/40 will-change-transform" style={{ animationDelay: "-5s" }} />
          <div ref={blob3} className="blob absolute bottom-0 left-1/3 w-[340px] h-[340px] rounded-full bg-[color:var(--brand-3)]/35 will-change-transform" style={{ animationDelay: "-9s" }} />
        </div>

        <div ref={heroContent} className="will-change-transform">


          <div className="inline-flex items-center gap-2 rounded-full border bg-card/70 backdrop-blur px-3 py-1 text-xs text-muted-foreground mb-6 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-gradient-brand"></span>
            {t.hero.badge}
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] max-w-4xl mx-auto animate-fade-in">
            {t.hero.title1}<span className="font-brand text-gradient-brand bg-gradient-brand-animated">{t.hero.titleAccent}</span>{t.hero.titleEnd}
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
            {t.hero.subtitle}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in">
            <Button asChild size="lg" className="rounded-full px-8 h-12 text-base bg-gradient-brand hover:opacity-90 text-white border-0 shadow-lg shadow-[color:var(--brand-2)]/30 hover-scale">
              <a href="#contacto">{t.hero.ctaPrimary} <ArrowRight className="w-4 h-4 ml-1" /></a>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-8 h-12 text-base hover-scale">
              <a href="#servicios">{t.hero.ctaSecondary}</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="servicios" className="max-w-7xl mx-auto px-6 md:px-10 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">{t.services.eyebrow} <span className="font-brand text-gradient-brand">{t.services.accent}</span></h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            {t.services.subtitle}
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Instagram, title: t.services.items[0].title, desc: t.services.items[0].desc, tone: "var(--brand-2)" },
            { icon: Megaphone, title: t.services.items[1].title, desc: t.services.items[1].desc, tone: "var(--brand-1)" },
            { icon: BarChart3, title: t.services.items[2].title, desc: t.services.items[2].desc, tone: "var(--brand-3)" },
          ].map(({ icon: Icon, title, desc, tone }) => (
            <div
              key={title}
              className="group relative rounded-3xl border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden"
            >
              <div
                aria-hidden
                className="absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-0"
                style={{ background: `radial-gradient(600px circle at 0% 0%, color-mix(in oklab, ${tone} 18%, transparent), transparent 40%)` }}
              />
              <div
                className="relative w-11 h-11 rounded-2xl grid place-items-center mb-4 text-white shadow-md"
                style={{ background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 60%, white))` }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="relative text-lg font-semibold">{title}</h3>
              <p className="relative text-sm text-muted-foreground mt-2 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="como" className="relative bg-secondary/40 py-20 overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-0 opacity-60">
          <div className="blob absolute top-10 left-1/4 w-[300px] h-[300px] rounded-full bg-[color:var(--brand-2)]/25" />
          <div className="blob absolute bottom-0 right-1/4 w-[260px] h-[260px] rounded-full bg-[color:var(--brand-1)]/25" style={{ animationDelay: "-7s" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">{t.how.eyebrow} <span className="font-brand text-gradient-brand">{t.how.accent}</span></h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {t.how.steps.map((s) => (
              <div key={s.n} className="rounded-3xl bg-card border p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="text-sm font-semibold tracking-widest text-gradient-brand">{s.n}</div>
                <h3 className="mt-3 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA contact */}
      <section id="contacto" className="max-w-4xl mx-auto px-6 md:px-10 py-24 text-center">
        <h2 className="text-4xl md:text-6xl font-semibold tracking-tight">
          {t.contact.title1}<span className="font-brand text-gradient-brand">{t.contact.accent}</span>{t.contact.title2}
        </h2>
        <p className="mt-5 text-lg text-muted-foreground">
          {t.contact.subtitle}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-full px-8 h-12 text-base bg-gradient-brand hover:opacity-90 text-white border-0 shadow-lg shadow-[color:var(--brand-2)]/30 hover-scale">
            <a
              href={`https://wa.me/56989294014?text=${encodeURIComponent(t.contact.whatsappMessage)}`}
              target="_blank"
              rel="noreferrer"
            >
              {t.contact.whatsapp}
            </a>
          </Button>
        </div>
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {t.contact.bullets.map((b) => (
            <li key={b} className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> {b}</li>
          ))}
        </ul>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}
