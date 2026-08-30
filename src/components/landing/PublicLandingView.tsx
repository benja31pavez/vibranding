import { MessageCircle, Mail, Phone, MapPin, Instagram, Facebook, ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";
import {
  landingPalette, templateKey, heroAspectKey, HERO_ASPECT_CSS, serviceIcon,
  asArray, asObject, WEEKDAYS, withAlpha, resolveSectionOrder,
  type Testimonial, type FaqItem, type LandingLocation, type LandingFooter, type OpeningHour,
  type LandingSectionKey,
} from "@/lib/landingTheme";
import { landingWhatsappUrl } from "@/lib/landingWhatsapp";

export type LandingLike = Record<string, any>;

type Props = {
  lp: LandingLike;
  /** Rendered inside the contact section on the real page; preview passes a dummy. */
  contactForm?: React.ReactNode;
  /** Disables outbound links / tracking for the editor preview. */
  preview?: boolean;
  /** Scales typography down for the small editor frames. */
  compact?: boolean;
  onCtaClick?: () => void;
  onWhatsappClick?: () => void;
};

export function PublicLandingView({ lp, contactForm, preview, compact, onCtaClick, onWhatsappClick }: Props) {
  const p = landingPalette(lp.theme_color, !!lp.dark_mode);
  const template = templateKey(lp.template);
  const aspect = HERO_ASPECT_CSS[heroAspectKey(lp.hero_aspect)];
  const services = asArray<{ title: string; description: string; icon?: string }>(lp.services);
  const gallery = asArray<{ url: string }>(lp.gallery);
  const testimonials = asArray<Testimonial>(lp.testimonials);
  const faq = asArray<FaqItem>(lp.faq);
  const location = asObject<LandingLocation>(lp.location);
  const footer = asObject<LandingFooter>(lp.footer);
  const waUrl = preview ? null : landingWhatsappUrl(lp as any);

  const pad = compact ? "px-4 py-7" : "px-6 py-16 md:py-20";
  const padTight = compact ? "px-4 py-5" : "px-6 py-10 md:py-12";
  const h1 = compact ? "text-xl" : "text-4xl md:text-6xl";
  const h2 = compact ? "text-sm" : "text-2xl md:text-3xl";
  const body = compact ? "text-[11px]" : "text-base md:text-lg";
  const small = compact ? "text-[10px]" : "text-sm";

  const ctaEl = lp.cta_text ? (
    <a
      href={preview ? undefined : lp.cta_url || "#contacto"}
      onClick={onCtaClick}
      className={`inline-flex items-center rounded-full font-medium transition hover:opacity-90 ${compact ? "mt-3 px-3 py-1.5 text-[10px]" : "mt-8 px-7 py-3"}`}
      style={{ background: p.brand, color: p.onBrand }}
      {...(!preview && lp.cta_url ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {lp.cta_text}
    </a>
  ) : null;

  const heroText = (
    <div>
      <h1 className={`${h1} font-bold tracking-tight`} style={{ color: p.brandText }}>
        {lp.hero_title || "Título"}
      </h1>
      {lp.hero_subtitle && (
        <p className={`${compact ? "mt-2" : "mt-5"} ${body} whitespace-pre-line`} style={{ color: p.muted }}>
          {lp.hero_subtitle}
        </p>
      )}
      {ctaEl}
    </div>
  );

  const sectionOrder = resolveSectionOrder((lp as any).section_order);

  const sectionNodes: Record<LandingSectionKey, React.ReactNode> = {
    /* Services — brand tinted band */
    servicios: services.length > 0 ? (
      <section data-section="servicios" className={pad} style={{ background: p.tint }}>
        <div className="max-w-6xl mx-auto">
          <h2 className={`${h2} font-bold text-center ${compact ? "mb-3" : "mb-12"}`}>Servicios</h2>
          <div className={compact ? "space-y-2" : "grid md:grid-cols-3 gap-6"}>
            {services.map((s, i) => {
              const Icon = serviceIcon(s.icon);
              return (
                <div
                  key={i}
                  className={`${compact ? "rounded-xl p-3" : "rounded-2xl p-6"} border`}
                  style={{ background: p.surface, borderColor: p.border }}
                >
                  <div
                    className={`grid place-items-center ${compact ? "w-6 h-6 rounded-md mb-2" : "w-11 h-11 rounded-xl mb-4"}`}
                    style={{ background: withAlpha(p.brand, p.isDark ? 0.25 : 0.14), color: p.brandText }}
                  >
                    {Icon ? (
                      <Icon className={compact ? "w-3.5 h-3.5" : "w-5 h-5"} />
                    ) : (
                      <span className={`font-semibold ${compact ? "text-[10px]" : "text-sm"}`}>{i + 1}</span>
                    )}
                  </div>
                  <h3 className={`font-semibold ${compact ? "text-xs" : "text-lg"}`} style={{ color: p.brandText }}>{s.title}</h3>
                  <p className={`mt-2 ${small} whitespace-pre-line`} style={{ color: p.muted }}>{s.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    ) : null,

    /* Gallery */
    galeria: gallery.length > 0 ? (
      <section data-section="galeria" className={pad}>
        <div className="max-w-6xl mx-auto">
          <h2 className={`${h2} font-bold text-center ${compact ? "mb-3" : "mb-12"}`}>Galería</h2>
          <div className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 md:grid-cols-3 gap-3"}>
            {gallery.map((g, i) => (
              <img key={i} src={g.url} alt="" className="w-full aspect-square object-cover rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    ) : null,

    /* WhatsApp CTA — full-bleed brand band */
    whatsapp: (waUrl || (preview && lp.whatsapp_enabled)) ? (
      <section data-section="whatsapp" className={padTight} style={{ background: p.band, color: p.onBand }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className={`${h2} font-bold`}>{lp.whatsapp_cta_text || "Escríbenos por WhatsApp"}</h2>
          <p className={`mt-2 ${small}`} style={{ opacity: 0.85 }}>
            Te respondemos por WhatsApp con el mensaje ya listo para enviar.
          </p>
          <a
            href={waUrl ?? undefined}
            target={preview ? undefined : "_blank"}
            rel="noreferrer"
            onClick={onWhatsappClick}
            className={`inline-flex items-center gap-2 rounded-full font-medium transition hover:opacity-90 ${compact ? "mt-3 px-3 py-1.5 text-[10px]" : "mt-6 px-7 py-3"}`}
            style={{ background: "#25D366", color: "#0a0a0a" }}
          >
            <MessageCircle className={compact ? "w-3.5 h-3.5" : "w-5 h-5"} />
            {lp.whatsapp_cta_text || "Escríbenos por WhatsApp"}
          </a>
        </div>
      </section>
    ) : null,

    /* Testimonials */
    testimonios: (lp.testimonials_enabled && testimonials.length > 0) ? (
      <section data-section="testimonios" className={padTight} style={{ background: p.tint }}>
        <div className="max-w-5xl mx-auto">
          <h2 className={`${h2} font-bold text-center ${compact ? "mb-3" : "mb-8"}`}>Lo que dicen</h2>
          <div className={compact ? "space-y-2" : "grid md:grid-cols-3 gap-5"}>
            {testimonials.map((t, i) => (
              <figure key={i} className={`${compact ? "rounded-xl p-3" : "rounded-2xl p-5"} border`} style={{ background: p.surface, borderColor: p.border }}>
                <blockquote className={`${small} italic`} style={{ color: p.text }}>“{t.quote}”</blockquote>
                <figcaption className="mt-3 flex items-center gap-2">
                  {t.photo_url ? (
                    <img src={t.photo_url} alt="" className={`${compact ? "w-6 h-6" : "w-9 h-9"} rounded-full object-cover`} />
                  ) : (
                    <div className={`${compact ? "w-6 h-6 text-[9px]" : "w-9 h-9 text-xs"} rounded-full grid place-items-center font-semibold`} style={{ background: withAlpha(p.brand, 0.18), color: p.brandText }}>
                      {(t.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className={small}>
                    <div className="font-medium">{t.name}</div>
                    {t.role && <div style={{ color: p.muted }}>{t.role}</div>}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    ) : null,

    /* Location & hours */
    ubicacion: (lp.location_enabled && (location.address || location.map_embed_url || (location.hours ?? []).length > 0)) ? (
      <section data-section="ubicacion" className={padTight}>
        <div className="max-w-5xl mx-auto">
          <h2 className={`${h2} font-bold text-center ${compact ? "mb-3" : "mb-8"}`}>Dónde y cuándo</h2>
          <div className={compact ? "space-y-3" : "grid md:grid-cols-2 gap-6 items-start"}>
            <div className={`${compact ? "rounded-xl p-3" : "rounded-2xl p-5"} border`} style={{ background: p.surface, borderColor: p.border }}>
              {location.address && (
                <p className={`${small} flex items-start gap-2`}>
                  <MapPin className="w-4 h-4 shrink-0" style={{ color: p.brandText }} />
                  <span>{location.address}</span>
                </p>
              )}
              <ul className={`mt-3 ${small} space-y-1`}>
                {(location.hours ?? []).map((h: OpeningHour) => (
                  <li key={h.day} className="flex justify-between gap-3">
                    <span>{WEEKDAYS[h.day] ?? ""}</span>
                    <span style={{ color: p.muted }}>{h.closed ? "Cerrado" : `${h.from ?? "—"} – ${h.to ?? "—"}`}</span>
                  </li>
                ))}
              </ul>
            </div>
            {location.map_embed_url && !preview && (
              <iframe
                src={location.map_embed_url}
                title="Mapa"
                className="w-full rounded-2xl border"
                style={{ borderColor: p.border, aspectRatio: "4 / 3" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
            {location.map_embed_url && preview && (
              <div className="w-full rounded-xl border grid place-items-center" style={{ borderColor: p.border, aspectRatio: "4 / 3", color: p.muted }}>
                <span className={small}>Mapa</span>
              </div>
            )}
          </div>
        </div>
      </section>
    ) : null,

    /* FAQ */
    faq: (lp.faq_enabled && faq.length > 0) ? (
      <section data-section="faq" className={padTight} style={{ background: p.tint }}>
        <div className="max-w-3xl mx-auto">
          <h2 className={`${h2} font-bold text-center ${compact ? "mb-3" : "mb-8"}`}>Preguntas frecuentes</h2>
          <div className="space-y-2">
            {faq.map((f, i) => <FaqRow key={i} item={f} palette={p} small={small} />)}
          </div>
        </div>
      </section>
    ) : null,
  };

  return (
    <div style={{ background: p.background, color: p.text }} className="min-h-full">
      {/* Hero */}
      {template === "fullbleed" && lp.hero_image_url ? (
        <section className="relative overflow-hidden">
          <img src={lp.hero_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} />
          <div className={`relative max-w-4xl mx-auto text-center ${compact ? "px-4 py-12" : "px-6 py-28 md:py-36"}`}>
            <h1 className={`${h1} font-bold tracking-tight`} style={{ color: "#ffffff" }}>
              {lp.hero_title || "Título"}
            </h1>
            {lp.hero_subtitle && (
              <p className={`${compact ? "mt-2" : "mt-5"} ${body} whitespace-pre-line`} style={{ color: "rgba(255,255,255,0.85)" }}>
                {lp.hero_subtitle}
              </p>
            )}
            {ctaEl}
          </div>
        </section>
      ) : template === "centered" ? (
        <section className={`${pad} max-w-3xl mx-auto text-center`}>
          {heroText}
          {lp.hero_image_url && (
            <img
              src={lp.hero_image_url}
              alt=""
              className={`w-full object-cover ${compact ? "mt-4 rounded-xl" : "mt-10 rounded-3xl shadow-2xl"}`}
              style={{ aspectRatio: aspect }}
            />
          )}
        </section>
      ) : (
        <section className={`${pad} max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center`}>
          {heroText}
          {lp.hero_image_url && (
            <img
              src={lp.hero_image_url}
              alt=""
              className={`w-full object-cover ${compact ? "rounded-xl" : "rounded-3xl shadow-2xl"}`}
              style={{ aspectRatio: aspect }}
            />
          )}
        </section>
      )}

      {sectionOrder.map(key => <Fragment key={key}>{sectionNodes[key]}</Fragment>)}


      {/* Contact */}
      {lp.contact_enabled && (
        <section id="contacto" className={pad}>
          <div className="max-w-xl mx-auto">
            <h2 className={`${h2} font-bold text-center mb-2`}>Contáctanos</h2>
            <p className={`text-center ${small} mb-6`} style={{ color: p.muted }}>Te responderemos lo antes posible.</p>
            {contactForm ?? (
              <div className={`rounded-2xl border p-3 space-y-2`} style={{ background: p.surface, borderColor: p.border }}>
                <div className="h-6 rounded border" style={{ borderColor: p.border }} />
                <div className="h-6 rounded border" style={{ borderColor: p.border }} />
                <div className="h-12 rounded border" style={{ borderColor: p.border }} />
                <div className={`h-7 rounded grid place-items-center ${small}`} style={{ background: p.brand, color: p.onBrand }}>Enviar mensaje</div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: p.border }}>
        <div className={`max-w-6xl mx-auto ${compact ? "px-4 py-4" : "px-6 py-10"} ${compact ? "space-y-2" : "grid md:grid-cols-3 gap-6"}`}>
          <div>
            <div className={`font-semibold ${compact ? "text-xs" : ""}`} style={{ color: p.brandText }}>{lp.hero_title}</div>
            {footer.address && <p className={`mt-1 ${small}`} style={{ color: p.muted }}>{footer.address}</p>}
          </div>
          <ul className={`${small} space-y-1`} style={{ color: p.muted }}>
            {footer.email && (
              <li><a className="inline-flex items-center gap-1 hover:underline" href={`mailto:${footer.email}`}><Mail className="w-3.5 h-3.5" /> {footer.email}</a></li>
            )}
            {footer.phone && (
              <li><a className="inline-flex items-center gap-1 hover:underline" href={`tel:${footer.phone}`}><Phone className="w-3.5 h-3.5" /> {footer.phone}</a></li>
            )}
            {footer.whatsapp && (
              <li><a className="inline-flex items-center gap-1 hover:underline" href={`https://wa.me/${footer.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a></li>
            )}
          </ul>
          <div className={`${small} space-y-2`} style={{ color: p.muted }}>
            <div className="flex items-center gap-3">
              {footer.instagram && (
                <a href={footer.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram className="w-4 h-4" /></a>
              )}
              {footer.facebook && (
                <a href={footer.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook className="w-4 h-4" /></a>
              )}
              {footer.tiktok && (
                <a href={footer.tiktok} target="_blank" rel="noreferrer" className="font-semibold text-xs">TikTok</a>
              )}
            </div>
            <ul className="space-y-1">
              {(footer.legal ?? []).map((l, i) => (
                <li key={i}><a href={l.url} className="hover:underline" target="_blank" rel="noreferrer">{l.label}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className={`text-center ${compact ? "pb-3 text-[9px]" : "pb-6 text-xs"}`} style={{ color: p.muted }}>
          © {new Date().getFullYear()} {lp.hero_title}
        </div>
      </footer>
    </div>
  );
}

function FaqRow({ item, palette, small }: { item: FaqItem; palette: ReturnType<typeof landingPalette>; small: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: palette.surface, borderColor: palette.border }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-3 text-left px-4 py-3 font-medium ${small}`}
      >
        {item.question}
        <ChevronDown className={`w-4 h-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <p className={`px-4 pb-3 ${small} whitespace-pre-line`} style={{ color: palette.muted }}>{item.answer}</p>
      )}
    </div>
  );
}
