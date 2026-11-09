import { ArrowRight, Facebook, Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Fragment, useState } from "react";
import {
  landingPalette,
  templateKey,
  heroAspectKey,
  HERO_ASPECT_CSS,
  asArray,
  asObject,
  withAlpha,
  resolveSectionOrder,
  resolveHiddenSections,
  type Testimonial,
  type FaqItem,
  type LandingLocation,
  type LandingFooter,
  type LandingSectionKey,
  type LandingPalette,
  type GalleryItem,
  type HeroAspect,
} from "@/lib/landingTheme";
import { landingWhatsappUrl, type LandingWaConfig } from "@/lib/landingWhatsapp";
import { buildLandingStructuredData, jsonLd, landingPhone } from "@/lib/site/landingSeo";
import { formatChileMobile, normalizeChileMobile } from "@/lib/site/validation";
import {
  isExternalHref,
  safeHref,
  safeImageSrc,
  safeMapEmbedSrc,
  safeWebUrl,
} from "@/lib/site/safeUrl";
import { LandingContactForm } from "@/components/landing/LandingContactForm";
import { WhatsappFab } from "@/components/landing/WhatsappFab";
import { ContactSection } from "@/components/landing/public/ContactSection";
import {
  FaqRow,
  GalleryLightbox,
  SectionHeading,
  SocialLink,
} from "@/components/landing/public/parts";
import {
  Avatar,
  GallerySection,
  LocationSection,
  ServicesSection,
  TestimonialsSection,
  WhatsappBand,
  type ServiceItem,
} from "@/components/landing/public/sections";

export type LandingLike = Record<string, any>;

/** Dimensiones intrínsecas declaradas para evitar saltos de diseño (CLS). */
const HERO_DIMENSIONS: Record<HeroAspect, { width: number; height: number }> = {
  square: { width: 1200, height: 1200 },
  portrait: { width: 1200, height: 1500 },
  landscape: { width: 1600, height: 900 },
};

const PAD = "px-4 sm:px-6 py-16 md:py-24 scroll-mt-16";
const H1 =
  "text-[2.35rem] leading-[1.05] sm:text-5xl md:text-6xl lg:text-[4.25rem] font-bold tracking-[-0.025em] [overflow-wrap:anywhere] [text-wrap:balance]";

/** Enlaces del encabezado (solo escritorio) hacia las secciones visibles. */
const NAV_LABEL: Partial<Record<LandingSectionKey, string>> = {
  servicios: "Servicios",
  galeria: "Trabajos",
  testimonios: "Opiniones",
  ubicacion: "Cobertura",
  faq: "Preguntas",
};

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
    : asArray<GalleryItem>(lp.gallery)
        .map((g) => ({
          ...g,
          url: safeImageSrc(g?.url) ?? "",
          before_url: safeImageSrc(g?.before_url),
        }))
        .filter((g) => g.url);
  // Nunca se publican testimonios vacíos (las plantillas dejan marcadores para completar).
  const allTestimonials = asArray<Testimonial>(lp.testimonials).map((t) => ({
    ...t,
    photo_url: safeImageSrc(t?.photo_url),
  }));
  const realTestimonials = allTestimonials.filter((t) => t?.quote?.trim() && t?.name?.trim());
  const testimonials = preview ? allTestimonials : realTestimonials;
  const faq = asArray<FaqItem>(lp.faq);
  const location = asObject<LandingLocation>(lp.location);
  const footer = asObject<LandingFooter>(lp.footer);
  const waUrl = safeHref(landingWhatsappUrl(lp as LandingWaConfig));
  const heroSrc = safeImageSrc(lp.hero_image_url);
  const mapSrc = safeMapEmbedSrc(location.map_embed_url);
  const emailHref = footer.email ? safeHref(`mailto:${footer.email.trim()}`) : null;
  const footerWa = normalizeChileMobile(footer.whatsapp);
  const socials: [string, string][] = [];
  for (const [label, raw] of [
    ["Instagram", footer.instagram],
    ["Facebook", footer.facebook],
    ["TikTok", footer.tiktok],
  ] as const) {
    const href = safeWebUrl(raw);
    if (href) socials.push([label, href]);
  }
  const legal = (footer.legal ?? [])
    .map((l) => ({ label: (l?.label ?? "").trim(), url: safeWebUrl(l?.url) }))
    .filter((l): l is { label: string; url: string } => !!l.label && !!l.url);
  const comunas = (location.comunas ?? []).filter(Boolean);
  const rawPhone = landingPhone(lp);
  const phone = rawPhone ? formatChileMobile(rawPhone) : null;
  const telHref = phone ? safeHref(`tel:${phone.replace(/[^\d+]/g, "")}`) : null;
  const place = footer.address || [location.comuna, location.region].filter(Boolean).join(", ");

  const [lightbox, setLightbox] = useState<number | null>(null);

  /* hero_title es NOT NULL pero puede venir vacío: nunca publicar el placeholder del editor. */
  const realTitle = (lp.hero_title || "").trim() || (lp.seo_title || "").trim();
  const displayTitle = realTitle || (preview ? "Título de la página" : "");
  const structuredData = preview ? [] : buildLandingStructuredData(lp);

  /* El CTA principal siempre apunta a un destino real. */
  const ctaHref: string | null =
    safeHref(lp.cta_url) || (lp.contact_enabled ? "#contacto" : waUrl) || null;
  const ctaExternal = isExternalHref(ctaHref);
  const onImage = template === "fullbleed" && !!heroSrc;
  const showTestimonials = !!lp.testimonials_enabled && testimonials.length > 0;

  const renderCta = (center: boolean) =>
    lp.cta_text && ctaHref ? (
      <div className={`mt-9 flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
        <a
          href={ctaHref}
          onClick={onCtaClick}
          className="group inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 text-base font-semibold transition hover:brightness-110 motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            background: p.brand,
            color: p.onBrand,
            outlineColor: onImage ? "#ffffff" : p.brand,
            boxShadow: `0 12px 28px -10px ${withAlpha(p.brand, 0.7)}`,
          }}
          {...(ctaExternal ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {lp.cta_text}
          <ArrowRight
            className="w-4 h-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </a>
        {waUrl && ctaHref !== waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            onClick={onWhatsappClick}
            className="inline-flex items-center justify-center gap-2 rounded-full border px-6 py-4 text-base font-semibold transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              borderColor: onImage ? "rgba(255,255,255,0.7)" : withAlpha(p.brandText, 0.4),
              color: onImage ? "#ffffff" : p.text,
              background: onImage ? "rgba(255,255,255,0.08)" : p.surface,
              outlineColor: onImage ? "#ffffff" : p.brand,
            }}
          >
            <MessageCircle className="w-5 h-5" style={{ color: "#25D366" }} aria-hidden="true" />
            WhatsApp
          </a>
        )}
      </div>
    ) : null;

  const coverage =
    comunas.length > 0 && lp.location_enabled ? (
      <span
        className="inline-flex items-center gap-1.5 rounded-xl sm:rounded-full px-3.5 py-1.5 text-sm font-medium text-left"
        style={
          onImage
            ? { background: "rgba(255,255,255,0.14)", color: "#ffffff" }
            : { background: p.tint, color: p.brandText }
        }
      >
        <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>
          Atendemos en {comunas.slice(0, 3).join(", ")}
          {comunas.length > 3 ? ` y ${comunas.length - 3} comunas más` : ""}
        </span>
      </span>
    ) : null;

  /* Prueba social real: solo testimonios completos y la sección activa. */
  const proofPeople = realTestimonials.slice(0, 3);
  const socialProof =
    lp.testimonials_enabled && proofPeople.length > 0 ? (
      <a
        href="#testimonios"
        className="mt-8 inline-flex items-center gap-3 rounded-full text-sm font-medium hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
        style={{ color: onImage ? "rgba(255,255,255,0.92)" : p.muted, outlineColor: p.brand }}
      >
        <span className="flex -space-x-2.5" aria-hidden="true">
          {proofPeople.map((t, i) => (
            <Avatar key={i} name={t.name} photo={t.photo_url} palette={p} size={34} ring />
          ))}
        </span>
        <span>
          {realTestimonials.length === 1
            ? "Lee lo que dice un cliente"
            : `Lee lo que dicen ${realTestimonials.length} clientes`}
        </span>
      </a>
    ) : null;

  const subtitle = (light: boolean) =>
    lp.hero_subtitle ? (
      <p
        className="mt-6 text-lg md:text-xl leading-relaxed whitespace-pre-line [text-wrap:pretty]"
        style={{ color: light ? "rgba(255,255,255,0.9)" : p.muted }}
      >
        {lp.hero_subtitle}
      </p>
    ) : null;

  const heroText = (center: boolean) => (
    <div className={`min-w-0 ${center ? "mx-auto" : ""}`}>
      {coverage && <div className="mb-6">{coverage}</div>}
      {displayTitle && <h1 className={H1}>{displayTitle}</h1>}
      <div className={center ? "max-w-2xl mx-auto" : "max-w-xl"}>{subtitle(false)}</div>
      {renderCta(center)}
      {socialProof}
    </div>
  );

  const heroImage = (rounded: string) =>
    heroSrc ? (
      <img
        src={heroSrc}
        alt=""
        width={heroDims.width}
        height={heroDims.height}
        fetchPriority="high"
        decoding="async"
        className={`relative w-full h-auto object-cover ${rounded}`}
        style={{
          aspectRatio: aspect,
          background: p.tint,
          boxShadow: `0 30px 60px -25px ${withAlpha(p.isDark ? "#000000" : p.brand, 0.45)}`,
        }}
      />
    ) : null;

  const ctaForServices = waUrl
    ? { href: waUrl, label: "Escríbenos por WhatsApp", external: true, onClick: onWhatsappClick }
    : lp.contact_enabled
      ? {
          href: "#contacto",
          label: "Cuéntanos qué necesitas",
          external: false,
          onClick: onCtaClick,
        }
      : null;

  const sectionNodes: Record<LandingSectionKey, React.ReactNode> = {
    servicios:
      services.length > 0 ? (
        <ServicesSection services={services} palette={p} cta={ctaForServices} />
      ) : null,
    galeria:
      gallery.length > 0 ? (
        <GallerySection gallery={gallery} palette={p} onOpen={(i) => !preview && setLightbox(i)} />
      ) : null,
    whatsapp:
      waUrl || (preview && lp.whatsapp_enabled) ? (
        <WhatsappBand
          palette={p}
          title={lp.whatsapp_cta_text || "Escríbenos por WhatsApp"}
          href={waUrl}
          onClick={onWhatsappClick}
        />
      ) : null,
    testimonios: showTestimonials ? (
      <TestimonialsSection testimonials={testimonials} palette={p} preview={preview} />
    ) : null,
    ubicacion:
      lp.location_enabled &&
      (location.address || mapSrc || comunas.length > 0 || (location.hours ?? []).length > 0) ? (
        <LocationSection
          palette={p}
          location={location}
          comunas={comunas}
          mapSrc={mapSrc}
          preview={preview}
          mapTitle={`Mapa de ${realTitle || "la ubicación"}`}
        />
      ) : null,
    faq:
      lp.faq_enabled && faq.length > 0 ? (
        <section id="faq" data-section="faq" className={PAD} style={{ background: p.tint }}>
          <div className="max-w-3xl mx-auto">
            <SectionHeading
              eyebrow="Resolvemos tus dudas"
              title="Preguntas frecuentes"
              palette={p}
            />
            <div className="space-y-3">
              {faq.map((f, i) => (
                <FaqRow key={i} item={f} palette={p} />
              ))}
            </div>
          </div>
        </section>
      ) : null,
    contacto: lp.contact_enabled ? (
      <section id="contacto" data-section="contacto" className={PAD}>
        <ContactSection
          palette={p}
          whatsappUrl={waUrl}
          onWhatsappClick={onWhatsappClick}
          phone={phone}
          telHref={telHref}
          email={footer.email}
          emailHref={emailHref}
          place={place || undefined}
          form={
            contactForm ?? (
              <LandingContactForm
                landingId={lp.id}
                palette={p}
                preview={preview}
                whatsappUrl={waUrl}
              />
            )
          }
        />
      </section>
    ) : null,
  };

  const order = resolveSectionOrder(lp.section_order);
  const navItems = order
    .filter((k) => sectionNodes[k] && NAV_LABEL[k])
    .slice(0, 4)
    .map((k) => ({ key: k, label: NAV_LABEL[k] as string }));

  return (
    <div
      style={{ background: p.background, color: p.text }}
      className="min-h-full overflow-x-clip antialiased"
    >
      {structuredData.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(node) }}
        />
      ))}

      {displayTitle && (
        <header
          className="sticky top-0 z-30 border-b backdrop-blur-md"
          style={{ borderColor: p.border, background: withAlpha(p.background, 0.86) }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <a
              href="#inicio"
              className="font-bold text-lg tracking-tight truncate rounded focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: p.text, outlineColor: p.brand }}
            >
              {displayTitle}
            </a>
            <div className="flex items-center gap-6 shrink-0">
              {navItems.length > 1 && (
                <nav aria-label="Secciones" className="hidden lg:block">
                  <ul className="flex items-center gap-6 text-sm font-medium">
                    {navItems.map((n) => (
                      <li key={n.key}>
                        <a
                          href={`#${n.key}`}
                          className="transition hover:opacity-100 opacity-75 rounded focus-visible:outline-2 focus-visible:outline-offset-2"
                          style={{ outlineColor: p.brand }}
                        >
                          {n.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
              {(waUrl || lp.contact_enabled) && (
                <a
                  href={waUrl ?? "#contacto"}
                  onClick={waUrl ? onWhatsappClick : onCtaClick}
                  {...(waUrl ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ background: p.brand, color: p.onBrand, outlineColor: p.brand }}
                >
                  {waUrl && <MessageCircle className="w-4 h-4" aria-hidden="true" />}
                  {waUrl ? "Escríbenos" : "Contacto"}
                </a>
              )}
            </div>
          </div>
        </header>
      )}

      <main id="inicio">
        {onImage ? (
          <section
            data-section="hero"
            className="relative overflow-hidden grid place-items-center min-h-[560px] md:min-h-[680px]"
            style={{ color: "#ffffff", background: "#111111" }}
          >
            <img
              src={heroSrc ?? undefined}
              alt=""
              width={heroDims.width}
              height={heroDims.height}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.78) 100%)",
              }}
            />
            <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 py-24 md:py-32">
              {coverage && <div className="mb-6">{coverage}</div>}
              {displayTitle && <h1 className={H1}>{displayTitle}</h1>}
              <div className="max-w-2xl mx-auto">{subtitle(true)}</div>
              {renderCta(true)}
              {socialProof}
            </div>
          </section>
        ) : template === "centered" ? (
          <section data-section="hero" className="relative overflow-hidden">
            <HeroGlow palette={p} />
            <div className={`relative ${PAD} max-w-4xl mx-auto text-center`}>
              {heroText(true)}
              {heroSrc && <div className="mt-14 md:mt-16">{heroImage("rounded-[2rem]")}</div>}
            </div>
          </section>
        ) : (
          <section data-section="hero" className="relative overflow-hidden">
            <HeroGlow palette={p} />
            <div
              className={`relative ${PAD} md:py-28 max-w-6xl mx-auto grid ${heroSrc ? "md:grid-cols-[1.1fr_1fr]" : ""} gap-12 lg:gap-16 items-center`}
            >
              {heroText(false)}
              {heroSrc && (
                <div className="relative">
                  <div
                    className="absolute -inset-2 md:-inset-4 rounded-[2.5rem] md:rotate-2"
                    style={{ background: withAlpha(p.brand, p.isDark ? 0.22 : 0.14) }}
                    aria-hidden="true"
                  />
                  {heroImage("rounded-[2rem]")}
                </div>
              )}
            </div>
          </section>
        )}

        {order.map((key) => (
          <Fragment key={key}>{sectionNodes[key]}</Fragment>
        ))}
      </main>

      <LandingFooterBlock
        palette={p}
        title={displayTitle}
        place={place}
        email={footer.email}
        emailHref={emailHref}
        phone={phone}
        telHref={telHref}
        footerWa={footerWa && !waUrl ? footerWa : null}
        socials={socials}
        legal={legal}
        roomForFab={!!(waUrl || lp.whatsapp_enabled)}
      />

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

/** Halo de marca detrás de la portada: da profundidad sin imagen extra. */
function HeroGlow({ palette: p }: { palette: LandingPalette }) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(60% 55% at 85% 0%, ${withAlpha(p.brand, p.isDark ? 0.28 : 0.16)}, transparent 70%), radial-gradient(45% 45% at 0% 100%, ${withAlpha(p.brand, p.isDark ? 0.14 : 0.08)}, transparent 70%)`,
      }}
      aria-hidden="true"
    />
  );
}

function LandingFooterBlock({
  palette: p,
  title,
  place,
  email,
  emailHref,
  phone,
  telHref,
  footerWa,
  socials,
  legal,
  roomForFab,
}: {
  palette: LandingPalette;
  title: string;
  place: string;
  email?: string;
  emailHref: string | null;
  phone: string | null;
  telHref: string | null;
  footerWa: string | null;
  socials: [string, string][];
  legal: { label: string; url: string }[];
  roomForFab: boolean;
}) {
  const linkCls =
    "inline-flex items-center gap-2 hover:underline underline-offset-4 rounded focus-visible:outline-2 focus-visible:outline-offset-2";
  return (
    <footer className="border-t" style={{ borderColor: p.border, background: p.tint }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-14 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="min-w-0">
          <div className="font-bold text-lg tracking-tight">{title}</div>
          {place && (
            <p className="mt-2 text-sm inline-flex items-start gap-1.5" style={{ color: p.muted }}>
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              {place}
            </p>
          )}
        </div>
        {(emailHref || (phone && telHref) || footerWa) && (
          <div className="min-w-0">
            <h2
              className="text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: p.muted }}
            >
              Contacto
            </h2>
            <ul className="mt-3 text-sm space-y-2.5 min-w-0">
              {emailHref && (
                <li>
                  <a
                    className={`${linkCls} break-all`}
                    href={emailHref}
                    style={{ outlineColor: p.brand }}
                  >
                    <Mail className="w-4 h-4 shrink-0" aria-hidden="true" /> {email}
                  </a>
                </li>
              )}
              {phone && telHref && (
                <li>
                  <a className={linkCls} href={telHref} style={{ outlineColor: p.brand }}>
                    <Phone className="w-4 h-4 shrink-0" aria-hidden="true" /> {phone}
                  </a>
                </li>
              )}
              {footerWa && (
                <li>
                  <a
                    className={linkCls}
                    href={`https://wa.me/${footerWa.slice(1)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ outlineColor: p.brand }}
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}
        {(socials.length > 0 || legal.length > 0) && (
          <div className="text-sm space-y-4 min-w-0">
            {socials.length > 0 && (
              <div>
                <h2
                  className="text-xs font-semibold uppercase tracking-[0.16em]"
                  style={{ color: p.muted }}
                >
                  Síguenos
                </h2>
                <div className="mt-3 flex items-center gap-2">
                  {socials.map(([label, href]) => (
                    <SocialLink key={label} href={href} label={label} palette={p}>
                      {label === "Instagram" ? (
                        <Instagram className="w-5 h-5" aria-hidden="true" />
                      ) : label === "Facebook" ? (
                        <Facebook className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <span className="font-semibold text-xs">TikTok</span>
                      )}
                    </SocialLink>
                  ))}
                </div>
              </div>
            )}
            {legal.length > 0 && (
              <ul className="space-y-1.5" style={{ color: p.muted }}>
                {legal.map((l, i) => (
                  <li key={i}>
                    <a
                      href={l.url}
                      className="hover:underline underline-offset-4"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div
        className={`border-t text-center text-xs px-4 pt-5 ${roomForFab ? "pb-24 sm:pb-6" : "pb-6"}`}
        style={{ color: p.muted, borderColor: p.border }}
      >
        © {new Date().getFullYear()} {title}
      </div>
    </footer>
  );
}
