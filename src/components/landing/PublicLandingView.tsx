import {
  MessageCircle,
  Mail,
  Phone,
  MapPin,
  Instagram,
  Facebook,
  ChevronDown,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useId, useState } from "react";
import {
  landingPalette,
  templateKey,
  heroAspectKey,
  HERO_ASPECT_CSS,
  serviceIcon,
  asArray,
  asObject,
  WEEKDAYS,
  withAlpha,
  resolveSectionOrder,
  resolveHiddenSections,
  type Testimonial,
  type FaqItem,
  type LandingLocation,
  type LandingFooter,
  type OpeningHour,
  type LandingSectionKey,
  type LandingPalette,
  type GalleryItem,
  type HeroAspect,
} from "@/lib/landingTheme";
import { landingWhatsappUrl } from "@/lib/landingWhatsapp";
import { buildLandingStructuredData, jsonLd, landingPhone } from "@/lib/site/landingSeo";
import { LandingContactForm } from "@/components/landing/LandingContactForm";
import { WhatsappFab } from "@/components/landing/WhatsappFab";

export type LandingLike = Record<string, any>;

type ServiceItem = { title: string; description: string; icon?: string };

/** Dimensiones intrínsecas declaradas para evitar saltos de diseño (CLS). */
const HERO_DIMENSIONS: Record<HeroAspect, { width: number; height: number }> = {
  square: { width: 1200, height: 1200 },
  portrait: { width: 1200, height: 1500 },
  landscape: { width: 1600, height: 900 },
};

const PAD = "px-4 sm:px-6 py-16 md:py-24";
const PAD_TIGHT = "px-4 sm:px-6 py-14 md:py-20";
const H1 =
  "text-[2.1rem] leading-[1.1] sm:text-5xl md:text-6xl font-bold tracking-tight [overflow-wrap:anywhere]";
const H2 = "text-2xl sm:text-3xl md:text-4xl";

type Props = {
  lp: LandingLike;
  /** Reemplaza el formulario de contacto por defecto. */
  contactForm?: React.ReactNode;
  /** Vista previa del editor: sin tracking, sin datos estructurados ni mapas externos. */
  preview?: boolean;
  onCtaClick?: () => void;
  onWhatsappClick?: () => void;
};

export function PublicLandingView({
  lp,
  contactForm,
  preview,
  onCtaClick,
  onWhatsappClick,
}: Props) {
  const p = landingPalette(lp.theme_color, !!lp.dark_mode);
  const template = templateKey(lp.template);
  const aspectKey = heroAspectKey(lp.hero_aspect);
  const aspect = HERO_ASPECT_CSS[aspectKey];
  const heroDims = HERO_DIMENSIONS[aspectKey];
  const hidden = resolveHiddenSections(lp.section_order);
  const services = hidden.includes("servicios") ? [] : asArray<ServiceItem>(lp.services);
  const gallery = hidden.includes("galeria")
    ? []
    : asArray<GalleryItem>(lp.gallery).filter((g) => g?.url);
  // Nunca se publican testimonios vacíos (las plantillas dejan marcadores para completar).
  const allTestimonials = asArray<Testimonial>(lp.testimonials);
  const testimonials = preview
    ? allTestimonials
    : allTestimonials.filter((t) => t?.quote?.trim() && t?.name?.trim());
  const faq = asArray<FaqItem>(lp.faq);
  const location = asObject<LandingLocation>(lp.location);
  const footer = asObject<LandingFooter>(lp.footer);
  const waUrl = landingWhatsappUrl(lp as any);
  const comunas = (location.comunas ?? []).filter(Boolean);
  const phone = landingPhone(lp);

  const [lightbox, setLightbox] = useState<number | null>(null);

  /* hero_title es NOT NULL pero puede venir vacío: nunca publicar el placeholder del editor. */
  const realTitle = (lp.hero_title || "").trim() || (lp.seo_title || "").trim();
  const displayTitle = realTitle || (preview ? "Título de la página" : "");
  const structuredData = preview ? [] : buildLandingStructuredData(lp);

  /* El CTA principal siempre apunta a un destino real. */
  const ctaHref: string | null =
    (lp.cta_url && String(lp.cta_url)) || (lp.contact_enabled ? "#contacto" : waUrl) || null;
  const ctaExternal = !!ctaHref && /^https?:/i.test(ctaHref);
  const onImage = template === "fullbleed" && !!lp.hero_image_url;

  const renderCta = (center: boolean) =>
    lp.cta_text && ctaHref ? (
      <div className={`mt-8 flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
        <a
          href={ctaHref}
          onClick={onCtaClick}
          className="inline-flex items-center justify-center rounded-full px-7 py-3.5 font-semibold transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: p.brand, color: p.onBrand, outlineColor: p.brand }}
          {...(ctaExternal ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {lp.cta_text}
        </a>
        {waUrl && ctaHref !== waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            onClick={onWhatsappClick}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 px-6 py-3 font-semibold transition hover:opacity-90"
            style={{
              borderColor: onImage ? "#ffffff" : p.brandText,
              color: onImage ? "#ffffff" : p.brandText,
            }}
          >
            <MessageCircle className="w-5 h-5" aria-hidden="true" /> WhatsApp
          </a>
        )}
      </div>
    ) : null;

  const coverage =
    comunas.length > 0 && lp.location_enabled ? (
      <p
        className="mt-4 text-sm inline-flex items-start gap-1.5"
        style={{ color: onImage ? "rgba(255,255,255,0.9)" : p.muted }}
      >
        <MapPin className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          Atendemos en {comunas.slice(0, 3).join(", ")}
          {comunas.length > 3 ? ` y ${comunas.length - 3} comunas más` : ""}
        </span>
      </p>
    ) : null;

  const heroText = (center: boolean) => (
    <div className="min-w-0">
      {displayTitle && (
        <h1 className={H1} style={{ color: p.brandText }}>
          {displayTitle}
        </h1>
      )}
      {lp.hero_subtitle && (
        <p className="mt-5 text-lg md:text-xl whitespace-pre-line" style={{ color: p.muted }}>
          {lp.hero_subtitle}
        </p>
      )}
      {coverage}
      {renderCta(center)}
    </div>
  );

  const heading = (eyebrow: string, title: string, tight?: boolean) => (
    <SectionHeading eyebrow={eyebrow} title={title} palette={p} tight={tight} />
  );

  const sectionNodes: Record<LandingSectionKey, React.ReactNode> = {
    servicios:
      services.length > 0 ? (
        <section data-section="servicios" className={PAD} style={{ background: p.tint }}>
          <div className="max-w-6xl mx-auto">
            {heading("Lo que hacemos", "Servicios")}
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.map((s, i) => {
                const Icon = serviceIcon(s.icon);
                return (
                  <li
                    key={i}
                    className="rounded-2xl p-6 md:p-7 border"
                    style={{ background: p.surface, borderColor: p.border }}
                  >
                    <div
                      className="grid place-items-center w-11 h-11 rounded-xl mb-4"
                      style={{
                        background: withAlpha(p.brand, p.isDark ? 0.25 : 0.14),
                        color: p.brandText,
                      }}
                      aria-hidden="true"
                    >
                      {Icon ? (
                        <Icon className="w-5 h-5" />
                      ) : (
                        <span className="font-semibold text-sm">{i + 1}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg" style={{ color: p.brandText }}>
                      {s.title}
                    </h3>
                    {s.description && (
                      <p
                        className="mt-2 text-[0.95rem] whitespace-pre-line"
                        style={{ color: p.muted }}
                      >
                        {s.description}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null,

    galeria:
      gallery.length > 0 ? (
        <section data-section="galeria" className={PAD}>
          <div className="max-w-6xl mx-auto">
            {heading("Nuestro trabajo", "Galería")}
            <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {gallery.map((g, i) =>
                g.before_url ? (
                  <li key={i} className="col-span-2 md:col-span-3">
                    <BeforeAfter item={g} palette={p} />
                  </li>
                ) : (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => !preview && setLightbox(i)}
                      className="block w-full rounded-xl overflow-hidden transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ outlineColor: p.brand }}
                    >
                      <img
                        src={g.url}
                        alt={g.alt || g.caption || `Trabajo ${i + 1}`}
                        width={600}
                        height={600}
                        loading="lazy"
                        decoding="async"
                        className="w-full aspect-square object-cover"
                      />
                      <span className="sr-only">Ampliar imagen</span>
                    </button>
                    {g.caption && (
                      <p className="mt-1.5 text-sm" style={{ color: p.muted }}>
                        {g.caption}
                      </p>
                    )}
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>
      ) : null,

    whatsapp:
      waUrl || (preview && lp.whatsapp_enabled) ? (
        <section
          data-section="whatsapp"
          className={PAD_TIGHT}
          style={{ background: p.band, color: p.onBand }}
        >
          <div className="max-w-2xl mx-auto text-center">
            <h2 className={`${H2} font-bold`}>
              {lp.whatsapp_cta_text || "Escríbenos por WhatsApp"}
            </h2>
            <p className="mt-3 text-base" style={{ opacity: 0.92 }}>
              Te respondemos rápido. El mensaje ya va escrito, sólo tienes que enviarlo.
            </p>
            <a
              href={waUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              onClick={onWhatsappClick}
              className="mt-7 inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-semibold transition hover:opacity-90"
              style={{ background: "#25D366", color: "#0a0a0a" }}
            >
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
              Abrir WhatsApp
            </a>
          </div>
        </section>
      ) : null,

    testimonios:
      lp.testimonials_enabled && testimonials.length > 0 ? (
        <section data-section="testimonios" className={PAD_TIGHT} style={{ background: p.tint }}>
          <div className="max-w-5xl mx-auto">
            {heading("Testimonios", "Lo que dicen nuestros clientes")}
            <div className="grid md:grid-cols-3 gap-5">
              {testimonials.map((t, i) => (
                <figure
                  key={i}
                  className={`rounded-2xl p-6 border ${t.quote?.trim() ? "" : "border-dashed"}`}
                  style={{ background: p.surface, borderColor: p.border }}
                >
                  <blockquote
                    className="text-base leading-relaxed"
                    style={{ color: t.quote?.trim() ? p.text : p.muted }}
                  >
                    {t.quote?.trim() ? `“${t.quote}”` : "Escribe aquí un testimonio real"}
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-3">
                    {t.photo_url ? (
                      <img
                        src={t.photo_url}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        decoding="async"
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 text-sm rounded-full grid place-items-center font-semibold"
                        style={{ background: withAlpha(p.brand, 0.18), color: p.brandText }}
                        aria-hidden="true"
                      >
                        {(t.name || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="text-sm">
                      <div className="font-medium">
                        {t.name || (preview ? "Nombre del cliente" : "")}
                      </div>
                      {t.role && <div style={{ color: p.muted }}>{t.role}</div>}
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null,

    ubicacion:
      lp.location_enabled &&
      (location.address ||
        location.map_embed_url ||
        comunas.length > 0 ||
        (location.hours ?? []).length > 0) ? (
        <section data-section="ubicacion" className={PAD_TIGHT}>
          <div className="max-w-5xl mx-auto">
            {heading(
              "Dónde estamos",
              comunas.length > 0 ? "Cobertura y horarios" : "Ubicación y horarios",
            )}
            <div className="grid md:grid-cols-2 gap-6 items-start">
              <div
                className="rounded-2xl p-6 border space-y-5"
                style={{ background: p.surface, borderColor: p.border }}
              >
                {(location.address || location.comuna) && (
                  <p className="text-base flex items-start gap-2">
                    <MapPin
                      className="w-5 h-5 shrink-0 mt-0.5"
                      style={{ color: p.brandText }}
                      aria-hidden="true"
                    />
                    <span>
                      {[location.address, location.comuna, location.region]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </p>
                )}
                {comunas.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold">Comunas donde atendemos</h3>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {comunas.map((c) => (
                        <li
                          key={c}
                          className="text-sm rounded-full px-3 py-1 border"
                          style={{ borderColor: p.border, background: p.tint }}
                        >
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(location.hours ?? []).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold">Horario de atención</h3>
                    <ul className="mt-2 text-sm space-y-1">
                      {(location.hours ?? []).map((h: OpeningHour) => (
                        <li key={h.day} className="flex justify-between gap-3">
                          <span>{WEEKDAYS[h.day] ?? ""}</span>
                          <span style={{ color: p.muted }}>
                            {h.closed ? "Cerrado" : `${h.from ?? "—"} – ${h.to ?? "—"}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {location.map_embed_url &&
                (preview ? (
                  <div
                    className="w-full rounded-2xl border grid place-items-center text-sm"
                    style={{ borderColor: p.border, aspectRatio: "4 / 3", color: p.muted }}
                  >
                    Mapa de Google
                  </div>
                ) : (
                  <iframe
                    src={location.map_embed_url}
                    title={`Mapa de ${realTitle || "la ubicación"}`}
                    className="w-full rounded-2xl border"
                    style={{ borderColor: p.border, aspectRatio: "4 / 3" }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ))}
            </div>
          </div>
        </section>
      ) : null,

    faq:
      lp.faq_enabled && faq.length > 0 ? (
        <section data-section="faq" className={PAD_TIGHT} style={{ background: p.tint }}>
          <div className="max-w-3xl mx-auto">
            {heading("Resolvemos tus dudas", "Preguntas frecuentes")}
            <div className="space-y-2">
              {faq.map((f, i) => (
                <FaqRow key={i} item={f} palette={p} />
              ))}
            </div>
          </div>
        </section>
      ) : null,

    contacto: lp.contact_enabled ? (
      <section id="contacto" data-section="contacto" className={PAD}>
        <div className="max-w-xl mx-auto">
          {heading("Hablemos", "Contáctanos", true)}
          <p className="text-center text-base mb-8" style={{ color: p.muted }}>
            Déjanos tus datos y te respondemos a la brevedad.
          </p>
          {contactForm ?? (
            <LandingContactForm
              landingId={lp.id}
              palette={p}
              preview={preview}
              whatsappUrl={waUrl}
            />
          )}
        </div>
      </section>
    ) : null,
  };

  return (
    <div style={{ background: p.background, color: p.text }} className="min-h-full overflow-x-clip">
      {structuredData.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(node) }}
        />
      ))}

      <main>
        {onImage ? (
          <section
            data-section="hero"
            className="relative overflow-hidden"
            style={{ color: "#ffffff" }}
          >
            <img
              src={lp.hero_image_url}
              alt=""
              width={heroDims.width}
              height={heroDims.height}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.58)" }} />
            <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 py-24 md:py-36">
              {displayTitle && <h1 className={H1}>{displayTitle}</h1>}
              {lp.hero_subtitle && (
                <p
                  className="mt-5 text-lg md:text-xl whitespace-pre-line"
                  style={{ color: "rgba(255,255,255,0.9)" }}
                >
                  {lp.hero_subtitle}
                </p>
              )}
              {coverage}
              {renderCta(true)}
            </div>
          </section>
        ) : template === "centered" ? (
          <section data-section="hero" className={`${PAD} max-w-3xl mx-auto text-center`}>
            {heroText(true)}
            {lp.hero_image_url && (
              <img
                src={lp.hero_image_url}
                alt=""
                width={heroDims.width}
                height={heroDims.height}
                fetchPriority="high"
                decoding="async"
                className="w-full h-auto object-cover mt-10 rounded-3xl shadow-2xl"
                style={{ aspectRatio: aspect }}
              />
            )}
          </section>
        ) : (
          <section
            data-section="hero"
            className={`${PAD} max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center`}
          >
            {heroText(false)}
            {lp.hero_image_url && (
              <img
                src={lp.hero_image_url}
                alt=""
                width={heroDims.width}
                height={heroDims.height}
                fetchPriority="high"
                decoding="async"
                className="w-full h-auto object-cover rounded-3xl shadow-2xl"
                style={{ aspectRatio: aspect }}
              />
            )}
          </section>
        )}

        {resolveSectionOrder(lp.section_order).map((key) => (
          <Fragment key={key}>{sectionNodes[key]}</Fragment>
        ))}
      </main>

      <footer className="border-t" style={{ borderColor: p.border }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-6 md:grid-cols-3">
          <div className="min-w-0">
            <div className="font-semibold" style={{ color: p.brandText }}>
              {displayTitle}
            </div>
            {(footer.address || location.comuna) && (
              <p className="mt-1 text-sm" style={{ color: p.muted }}>
                {footer.address || [location.comuna, location.region].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <ul className="text-sm space-y-2 min-w-0" style={{ color: p.muted }}>
            {footer.email && (
              <li>
                <a
                  className="inline-flex items-center gap-1.5 hover:underline break-all"
                  href={`mailto:${footer.email}`}
                >
                  <Mail className="w-4 h-4 shrink-0" aria-hidden="true" /> {footer.email}
                </a>
              </li>
            )}
            {phone && (
              <li>
                <a
                  className="inline-flex items-center gap-1.5 hover:underline"
                  href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                >
                  <Phone className="w-4 h-4 shrink-0" aria-hidden="true" /> {phone}
                </a>
              </li>
            )}
            {footer.whatsapp && !waUrl && (
              <li>
                <a
                  className="inline-flex items-center gap-1.5 hover:underline"
                  href={`https://wa.me/${footer.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> WhatsApp
                </a>
              </li>
            )}
          </ul>
          <div className="text-sm space-y-3" style={{ color: p.muted }}>
            <div className="flex items-center gap-2">
              {footer.instagram && (
                <SocialLink href={footer.instagram} label="Instagram">
                  <Instagram className="w-5 h-5" aria-hidden="true" />
                </SocialLink>
              )}
              {footer.facebook && (
                <SocialLink href={footer.facebook} label="Facebook">
                  <Facebook className="w-5 h-5" aria-hidden="true" />
                </SocialLink>
              )}
              {footer.tiktok && (
                <SocialLink href={footer.tiktok} label="TikTok">
                  <span className="font-semibold text-xs">TikTok</span>
                </SocialLink>
              )}
            </div>
            {(footer.legal ?? []).length > 0 && (
              <ul className="space-y-1">
                {(footer.legal ?? []).map((l, i) => (
                  <li key={i}>
                    <a href={l.url} className="hover:underline" target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div
          className={`text-center text-xs px-4 ${waUrl || lp.whatsapp_enabled ? "pb-24" : "pb-6"}`}
          style={{ color: p.muted }}
        >
          © {new Date().getFullYear()} {displayTitle}
        </div>
      </footer>

      {waUrl || (preview && lp.whatsapp_enabled) ? (
        <WhatsappFab
          href={waUrl}
          onClick={onWhatsappClick}
          label={lp.whatsapp_cta_text || "Escríbenos por WhatsApp"}
        />
      ) : null}

      {lightbox !== null && gallery[lightbox] && (
        <GalleryLightbox
          items={gallery}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}
    </div>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="grid place-items-center min-w-11 h-11 px-1 rounded-full hover:opacity-80"
    >
      {children}
    </a>
  );
}

function SectionHeading({
  eyebrow,
  title,
  palette,
  tight,
}: {
  eyebrow: string;
  title: string;
  palette: LandingPalette;
  tight?: boolean;
}) {
  return (
    <div className={`text-center ${tight ? "mb-4" : "mb-10 md:mb-14"}`}>
      <div
        className="text-xs font-semibold uppercase tracking-[0.18em]"
        style={{ color: palette.brandText }}
      >
        {eyebrow}
      </div>
      <h2 className={`${H2} font-bold tracking-tight mt-3`}>{title}</h2>
      <div
        className="mx-auto rounded-full mt-5 h-1 w-12"
        style={{ background: palette.brand }}
        aria-hidden="true"
      />
    </div>
  );
}

function BeforeAfter({ item, palette: p }: { item: GalleryItem; palette: LandingPalette }) {
  const tag = (text: string) => (
    <span
      className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: "rgba(0,0,0,0.75)", color: "#ffffff" }}
    >
      {text}
    </span>
  );
  const photo = (src: string, label: string) => (
    <div className="relative rounded-xl overflow-hidden">
      <img
        src={src}
        alt={`${label}${item.caption ? `: ${item.caption}` : ""}`}
        width={800}
        height={600}
        loading="lazy"
        decoding="async"
        className="w-full aspect-[4/3] object-cover"
      />
      {tag(label)}
    </div>
  );
  return (
    <figure>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {photo(item.before_url ?? "", "Antes")}
        {photo(item.url, "Después")}
      </div>
      {item.caption && (
        <figcaption className="mt-2 text-sm text-center" style={{ color: p.muted }}>
          {item.caption}
        </figcaption>
      )}
    </figure>
  );
}

function GalleryLightbox({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const total = items.length;
  const go = useCallback(
    (delta: number) => onIndex((index + delta + total) % total),
    [index, total, onIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [go, onClose]);

  const current = items[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Galería de imágenes"
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "rgba(0,0,0,0.9)" }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar galería"
        autoFocus
        className="absolute top-4 right-4 rounded-full p-2 text-white/80 hover:text-white"
      >
        <X className="w-6 h-6" />
      </button>
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Imagen anterior"
            className="absolute left-2 md:left-6 rounded-full p-2 text-white/80 hover:text-white"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Imagen siguiente"
            className="absolute right-2 md:right-6 rounded-full p-2 text-white/80 hover:text-white"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}
      <img
        src={current.url}
        alt={current.alt || current.caption || `Imagen ${index + 1} de ${total}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full object-contain rounded-lg"
      />
      {total > 1 && (
        <div className="absolute bottom-5 text-xs text-white/80">
          {index + 1} / {total}
        </div>
      )}
    </div>
  );
}

function FaqRow({ item, palette }: { item: FaqItem; palette: LandingPalette }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const buttonId = `faq-btn-${uid}`;
  const panelId = `faq-panel-${uid}`;
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: palette.surface, borderColor: palette.border }}
    >
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-3 text-left px-4 py-4 font-medium text-base"
        >
          {item.question}
          <ChevronDown
            className={`w-5 h-5 shrink-0 transition ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </h3>
      {/* Se mantiene en el DOM para que la respuesta sea rastreable. */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="px-4 pb-4 text-base whitespace-pre-line"
        style={{ color: palette.muted }}
      >
        {item.answer}
      </div>
    </div>
  );
}
