import { MessageCircle, Mail, Phone, MapPin, Instagram, Facebook, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  landingPalette, templateKey, heroAspectKey, HERO_ASPECT_CSS, serviceIcon,
  asArray, asObject, WEEKDAYS, withAlpha,
  type Testimonial, type FaqItem, type LandingLocation, type LandingFooter, type OpeningHour,
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
