import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLang } from "@/i18n/LanguageContext";
import { translations } from "@/i18n/translations";
import { trackLandingEvent } from "@/lib/track";
import { usePublicPortfolio } from "@/lib/portfolio";
import {
  Instagram, Megaphone, BarChart3, ArrowRight, Check, ExternalLink, Sparkles,
  Search, Camera, MonitorSmartphone, MessageCircle,
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
  const { t, lang } = useLang();
  const { data: portfolio } = usePublicPortfolio();
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
        <nav className="hidden md:flex items-center gap-7 text-sm">
          <a href="#servicios" className="text-muted-foreground hover:text-foreground story-link inline-block min-w-[5.5rem] text-center"><span className="inline-block">{t.nav.services}</span></a>
          <a href="#como" className="text-muted-foreground hover:text-foreground story-link inline-block min-w-[8rem] text-center"><span className="inline-block">{t.nav.how}</span></a>
          <a href="#nosotros" className="text-muted-foreground hover:text-foreground story-link inline-block min-w-[7rem] text-center"><span className="inline-block">{t.nav.about}</span></a>
          
          <a href="#clientes" className="text-muted-foreground hover:text-foreground story-link inline-block min-w-[5rem] text-center"><span className="inline-block">{t.nav.clients}</span></a>
          <a href="#contacto" onClick={() => trackLandingEvent("contact_click", lang)} className="text-muted-foreground hover:text-foreground story-link inline-block min-w-[5rem] text-center"><span className="inline-block">{t.nav.contact}</span></a>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground inline-block min-w-[7rem] text-right">{t.nav.signIn}</Link>
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
            {t.hero.title1.trimEnd()}
            <span className="block font-brand text-gradient-brand bg-gradient-brand-animated">{t.hero.titleAccent}{t.hero.titleEnd}</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
            {t.hero.subtitle}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in">
            <Button asChild size="lg" className="rounded-full px-8 h-12 text-base bg-gradient-brand hover:opacity-90 text-white border-0 shadow-lg shadow-[color:var(--brand-2)]/30 hover-scale">
              <a href="#contacto" onClick={() => trackLandingEvent("contact_click", lang)}>{t.hero.ctaPrimary} <ArrowRight className="w-4 h-4 ml-1" /></a>
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

        <ServicesStepper
          items={t.services.items}
          icons={[Sparkles, Search, Camera, Megaphone, MonitorSmartphone, MessageCircle]}
        />
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
      {/* About us — Antonia & Benjamín */}
      <section id="nosotros" className="relative max-w-7xl mx-auto px-6 md:px-10 py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
              {t.about.title} <span className="font-brand text-gradient-brand">{t.about.accent}</span>
            </h2>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{t.about.subtitle}</p>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">{t.about.paragraph1}</p>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed">{t.about.paragraph2}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              {t.about.chips.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 rounded-full border bg-card/70 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-brand opacity-20 blur-3xl" />
            <div className="grid grid-cols-2 gap-4">
              {[
                { person: t.about.antonia, tone: "var(--brand-1)" },
                { person: t.about.benjamin, tone: "var(--brand-2)" },
              ].map(({ person, tone }, i) => (
                <div
                  key={person.name}
                  className="group relative rounded-3xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden"
                  style={{ marginTop: i === 1 ? "2.5rem" : 0 }}
                >
                  <div
                    aria-hidden
                    className="absolute inset-x-0 -top-px h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
                  />
                  <div
                    className="w-16 h-16 rounded-2xl grid place-items-center text-white text-2xl font-brand font-semibold shadow-md mb-4"
                    style={{ background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 55%, white))` }}
                    aria-hidden
                  >
                    {person.name.charAt(0)}
                  </div>
                  <div className="text-xs font-medium tracking-widest uppercase text-muted-foreground">{person.role}</div>
                  <h3 className="mt-1 text-2xl font-semibold font-brand">{person.name}</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{person.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Clients & work */}
      <section id="clientes" className="relative max-w-7xl mx-auto px-6 md:px-10 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
            {t.clients.eyebrow} <span className="font-brand text-gradient-brand">{t.clients.accent}</span>
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">{t.clients.subtitle}</p>
        </div>

        {portfolio.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card/40 p-10 text-center text-muted-foreground">
            <Sparkles className="w-6 h-6 mx-auto mb-3 text-[color:var(--brand-2)]" />
            {t.clients.empty}
          </div>
        ) : (
          <>
            {/* Logo marquee */}
            <div
              className="relative mb-14 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
            >
              <div className="flex w-max items-center animate-marquee gap-0 hover:[animation-play-state:paused]">
                {[...portfolio, ...portfolio].map((c, i) => (
                  <div key={`${c.id}-${i}`} className="flex items-center">
                    <a
                      href={c.website_url || `#client-${c.id}`}
                      target={c.website_url ? "_blank" : undefined}
                      rel={c.website_url ? "noreferrer" : undefined}
                      className="flex items-center px-10 opacity-70 hover:opacity-100 transition-opacity"
                      title={c.name}
                    >
                      {c.logo_url ? (
                        <img
                          src={c.logo_url}
                          alt={c.name}
                          className={`${c.name === "Essence Emporium" ? "h-12 md:h-14" : "h-8 md:h-10"} w-auto object-contain`}
                          style={{ filter: "brightness(0)" }}
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-base md:text-lg font-semibold tracking-tight">{c.name}</span>
                      )}
                    </a>
                    <span aria-hidden className="h-8 w-px bg-border/70" />
                  </div>
                ))}
              </div>
            </div>

            {/* Works grid */}
            <div className="space-y-16">
              {portfolio.filter((c) => c.works.length > 0).map((c) => (
                <div key={c.id} id={`client-${c.id}`}>
                  <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
                    <div className="flex items-center gap-3">
                      {c.logo_url && (
                        <img src={c.logo_url} alt={c.name} className="h-9 w-9 rounded-xl object-cover bg-muted" loading="lazy" />
                      )}
                      <div>
                        <h3 className="text-xl font-semibold">{c.name}</h3>
                        {(c.industry || c.description) && (
                          <p className="text-sm text-muted-foreground">{c.industry || c.description}</p>
                        )}
                      </div>
                    </div>
                    {c.website_url && (
                      <a
                        href={c.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {c.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {c.works.map((w) => {
                      const inner = (
                        <div className="group relative rounded-2xl overflow-hidden border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                          {w.image_url ? (
                            <div className="aspect-[4/5] overflow-hidden bg-muted">
                              <img
                                src={w.image_url}
                                alt={w.title || c.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="aspect-[4/5] bg-gradient-brand opacity-80" />
                          )}
                          {(w.title || w.description) && (
                            <div className="p-4">
                              {w.title && <div className="text-sm font-semibold">{w.title}</div>}
                              {w.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{w.description}</p>}
                            </div>
                          )}
                        </div>
                      );
                      return w.link_url ? (
                        <a key={w.id} href={w.link_url} target="_blank" rel="noreferrer">{inner}</a>
                      ) : (
                        <div key={w.id}>{inner}</div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
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
              onClick={() => trackLandingEvent("whatsapp_click", lang)}
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

type ServiceItem = { title: string; desc: string; why: string };
type IconType = React.ComponentType<{ className?: string }>;

const TONES = ["var(--brand-1)", "var(--brand-2)", "var(--brand-3)", "var(--brand-1)", "var(--brand-2)", "var(--brand-3)"];

function ServicesStepper({ items }: { items: ServiceItem[]; icons?: IconType[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-1.5 gap-y-6">
      {items.map((it, i) => {
        const tone = TONES[i];
        const isLast = i === items.length - 1;
        return (
          <div key={it.title} className="flex flex-col group">
            {/* Chevron header */}
            <div
              className="relative text-left transition-transform duration-300 group-hover:-translate-y-0.5"
              style={{
                clipPath: isLast
                  ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 18px 50%)"
                  : "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%, 18px 50%)",
                marginLeft: i === 0 ? "-18px" : "0",
                filter: `drop-shadow(0 8px 20px color-mix(in oklab, ${tone} 35%, transparent))`,
              }}
            >
              <div
                className="px-5 py-4 pl-9"
                style={{
                  background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 55%, white))`,
                  color: "white",
                }}
              >
                <div className="text-[10px] font-bold tracking-[0.2em] text-white/90">
                  PASO {String(i + 1).padStart(2, "0")}
                </div>
                <div className="mt-1 font-semibold text-sm md:text-base text-white leading-tight">
                  {it.title}
                </div>
              </div>
            </div>

            {/* Content card under each chevron */}
            <div
              className="relative mt-4 mx-1 rounded-2xl border bg-card p-5 overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl"
              style={{
                borderColor: `color-mix(in oklab, ${tone} 18%, hsl(var(--border)))`,
                background: `linear-gradient(180deg, color-mix(in oklab, ${tone} 6%, hsl(var(--card))) 0%, hsl(var(--card)) 70%)`,
              }}
            >
              {/* Big watermark number */}
              <div
                aria-hidden
                className="pointer-events-none absolute -top-4 -right-2 font-brand font-bold leading-none select-none"
                style={{
                  fontSize: "5rem",
                  color: `color-mix(in oklab, ${tone} 14%, transparent)`,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              {/* Accent corner glow */}
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-10 -left-10 w-32 h-32 rounded-full blur-2xl opacity-60 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `radial-gradient(circle, ${tone}, transparent 70%)` }}
              />

              <p className="relative text-sm text-foreground/85 leading-relaxed">{it.desc}</p>

              <div className="relative mt-4 pt-4 flex items-start gap-2">
                <span
                  aria-hidden
                  className="absolute left-0 right-0 top-0 h-px"
                  style={{
                    background: `linear-gradient(90deg, transparent, color-mix(in oklab, ${tone} 50%, transparent), transparent)`,
                  }}
                />
                <span
                  aria-hidden
                  className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: tone,
                    boxShadow: `0 0 10px ${tone}`,
                  }}
                />
                <p className="text-xs italic text-muted-foreground leading-relaxed">{it.why}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
