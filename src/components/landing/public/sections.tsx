import { ArrowRight, Clock, MapPin, MessageCircle, Quote } from "lucide-react";
import {
  serviceIcon,
  withAlpha,
  WEEKDAYS,
  type GalleryItem,
  type LandingLocation,
  type LandingPalette,
  type OpeningHour,
  type Testimonial,
} from "@/lib/landingTheme";
import { BeforeAfter, FramedImage, H2, SectionHeading } from "./parts";

export type ServiceItem = { title: string; description: string; icon?: string };

const WRAP = "px-4 sm:px-6 py-16 md:py-24 scroll-mt-16";

/** Grilla que se adapta a pocas tarjetas (1–2 no quedan perdidas a la izquierda). */
function gridFor(n: number): string {
  if (n === 1) return "max-w-xl mx-auto";
  if (n === 2 || n === 4) return "sm:grid-cols-2 max-w-4xl mx-auto";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

export function ServicesSection({
  services,
  palette: p,
  cta,
}: {
  services: ServiceItem[];
  palette: LandingPalette;
  cta: { href: string; label: string; external: boolean; onClick?: () => void } | null;
}) {
  return (
    <section
      id="servicios"
      data-section="servicios"
      className={WRAP}
      style={{ background: p.tint }}
    >
      <div className="max-w-6xl mx-auto">
        <SectionHeading eyebrow="Lo que hacemos" title="Servicios" palette={p} />
        <ul className={`grid gap-4 md:gap-5 ${gridFor(services.length)}`}>
          {services.map((s, i) => {
            const Icon = serviceIcon(s.icon);
            return (
              <li
                key={i}
                className="group relative flex flex-col rounded-3xl p-6 md:p-8 border transition duration-300 hover:shadow-xl motion-safe:hover:-translate-y-1"
                style={{ background: p.surface, borderColor: p.border }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="grid place-items-center w-12 h-12 rounded-2xl"
                    style={{
                      background: withAlpha(p.brand, p.isDark ? 0.25 : 0.12),
                      color: p.brandText,
                    }}
                    aria-hidden="true"
                  >
                    {Icon ? (
                      <Icon className="w-6 h-6" />
                    ) : (
                      <span className="font-bold">{i + 1}</span>
                    )}
                  </div>
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: withAlpha(p.text, 0.35) }}
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-6 font-semibold text-xl tracking-tight [text-wrap:balance]">
                  {s.title}
                </h3>
                {s.description && (
                  <p
                    className="mt-2.5 text-[0.98rem] leading-relaxed whitespace-pre-line"
                    style={{ color: p.muted }}
                  >
                    {s.description}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {cta && (
          <p className="mt-10 text-center text-base" style={{ color: p.muted }}>
            ¿Buscas algo distinto?{" "}
            <a
              href={cta.href}
              onClick={cta.onClick}
              {...(cta.external ? { target: "_blank", rel: "noreferrer" } : {})}
              className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
              style={{ color: p.brandText, outlineColor: p.brand }}
            >
              {cta.label}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </p>
        )}
      </div>
    </section>
  );
}

export function GallerySection({
  gallery,
  palette: p,
  onOpen,
}: {
  gallery: (GalleryItem & { url: string })[];
  palette: LandingPalette;
  onOpen: (i: number) => void;
}) {
  return (
    <section id="galeria" data-section="galeria" className={WRAP}>
      <div className="max-w-6xl mx-auto">
        <SectionHeading eyebrow="Nuestro trabajo" title="Trabajos realizados" palette={p} />
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {gallery.map((g, i) =>
            g.before_url ? (
              <li key={i} className="col-span-2 md:col-span-3 w-full max-w-4xl mx-auto py-2">
                <BeforeAfter item={g} palette={p} />
              </li>
            ) : (
              <li key={i}>
                <figure>
                  <button
                    type="button"
                    onClick={() => onOpen(i)}
                    className="group relative block w-full rounded-2xl overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ outlineColor: p.brand }}
                  >
                    <FramedImage
                      src={g.url}
                      alt={g.alt || g.caption || `Trabajo ${i + 1}`}
                      width={600}
                      height={600}
                      palette={p}
                      className="aspect-square"
                      imgClassName="motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
                    />
                    <span
                      className="absolute inset-0 opacity-0 transition group-hover:opacity-100"
                      style={{
                        background: "linear-gradient(to top, rgba(0,0,0,0.35), transparent 55%)",
                      }}
                      aria-hidden="true"
                    />
                    <span className="sr-only">Ampliar imagen</span>
                  </button>
                  {g.caption && (
                    <figcaption className="mt-2 text-sm" style={{ color: p.muted }}>
                      {g.caption}
                    </figcaption>
                  )}
                </figure>
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}

export function TestimonialsSection({
  testimonials,
  palette: p,
  preview,
}: {
  testimonials: (Testimonial & { photo_url: string | null })[];
  palette: LandingPalette;
  preview?: boolean;
}) {
  const cols =
    testimonials.length === 1
      ? "max-w-2xl mx-auto"
      : testimonials.length === 2 || testimonials.length === 4
        ? "md:grid-cols-2 max-w-4xl mx-auto"
        : "md:grid-cols-3";
  return (
    <section
      id="testimonios"
      data-section="testimonios"
      className={WRAP}
      style={{ background: p.tint }}
    >
      <div className="max-w-6xl mx-auto">
        <SectionHeading eyebrow="Testimonios" title="Lo que dicen nuestros clientes" palette={p} />
        <div className={`grid gap-4 md:gap-5 ${cols}`}>
          {testimonials.map((t, i) => {
            const filled = !!t.quote?.trim();
            return (
              <figure
                key={i}
                className={`flex flex-col rounded-3xl p-6 md:p-8 border ${filled ? "" : "border-dashed"}`}
                style={{ background: p.surface, borderColor: p.border }}
              >
                <Quote
                  className="w-8 h-8 -scale-x-100"
                  style={{ color: withAlpha(p.brand, 0.5) }}
                  aria-hidden="true"
                />
                <blockquote
                  className="mt-4 text-[1.05rem] md:text-lg leading-relaxed [text-wrap:pretty]"
                  style={{ color: filled ? p.text : p.muted }}
                >
                  {filled ? t.quote : "Escribe aquí un testimonio real"}
                </blockquote>
                <figcaption
                  className="mt-auto pt-6 flex items-center gap-3 border-t"
                  style={{ borderColor: withAlpha(p.brand, 0.14) }}
                >
                  <Avatar name={t.name} photo={t.photo_url} palette={p} />
                  <div className="text-sm min-w-0">
                    <div className="font-semibold truncate">
                      {t.name || (preview ? "Nombre del cliente" : "")}
                    </div>
                    {t.role && (
                      <div className="truncate" style={{ color: p.muted }}>
                        {t.role}
                      </div>
                    )}
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Avatar({
  name,
  photo,
  palette: p,
  size = 44,
  ring,
}: {
  name?: string;
  photo: string | null;
  palette: LandingPalette;
  size?: number;
  ring?: boolean;
}) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    ...(ring ? { boxShadow: `0 0 0 3px ${p.background}` } : {}),
  };
  return photo ? (
    <img
      src={photo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="rounded-full object-cover shrink-0"
      style={style}
    />
  ) : (
    <span
      className="rounded-full grid place-items-center font-semibold text-sm shrink-0"
      style={{
        ...style,
        background: `linear-gradient(${withAlpha(p.brand, 0.22)}, ${withAlpha(p.brand, 0.22)}), ${p.surface}`,
        color: p.brandText,
      }}
      aria-hidden="true"
    >
      {(name || "?").trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

export function WhatsappBand({
  palette: p,
  title,
  href,
  onClick,
}: {
  palette: LandingPalette;
  title: string;
  href: string | null;
  onClick?: () => void;
}) {
  return (
    <section data-section="whatsapp" className="px-4 sm:px-6 py-10 md:py-14">
      <div
        className="relative max-w-6xl mx-auto overflow-hidden rounded-[2rem] px-6 py-12 md:px-14 md:py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-8"
        style={{ background: p.band, color: p.onBand }}
      >
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
          style={{ background: withAlpha(p.onBand, 0.08) }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-16 -bottom-28 h-64 w-64 rounded-full"
          style={{ background: withAlpha(p.onBand, 0.06) }}
          aria-hidden="true"
        />
        <div className="relative max-w-xl">
          <h2 className={H2}>{title}</h2>
          <p className="mt-3 text-base md:text-lg" style={{ opacity: 0.9 }}>
            El mensaje ya va escrito: solo tienes que enviarlo y te respondemos por el mismo chat.
          </p>
        </div>
        <a
          href={href ?? undefined}
          target="_blank"
          rel="noreferrer"
          onClick={onClick}
          className="relative shrink-0 self-start md:self-auto inline-flex items-center gap-2.5 rounded-full px-7 py-4 text-base font-semibold shadow-lg transition hover:brightness-105 motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{ background: "#25D366", color: "#0a0a0a", outlineColor: p.onBand }}
        >
          <MessageCircle className="w-5 h-5" aria-hidden="true" />
          Abrir WhatsApp
        </a>
      </div>
    </section>
  );
}

export function LocationSection({
  palette: p,
  location,
  comunas,
  mapSrc,
  preview,
  mapTitle,
}: {
  palette: LandingPalette;
  location: LandingLocation;
  comunas: string[];
  mapSrc: string | null;
  preview?: boolean;
  mapTitle: string;
}) {
  const hours = location.hours ?? [];
  const address = [location.address, location.comuna, location.region].filter(Boolean).join(", ");
  const card = "rounded-3xl p-6 md:p-7 border";
  const cardStyle = { background: p.surface, borderColor: p.border };
  const label = (Icon: typeof MapPin, text: string) => (
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <span
        className="grid place-items-center w-8 h-8 rounded-lg"
        style={{ background: withAlpha(p.brand, p.isDark ? 0.25 : 0.12), color: p.brandText }}
        aria-hidden="true"
      >
        <Icon className="w-4 h-4" />
      </span>
      {text}
    </h3>
  );

  const info = (
    <div className={`grid gap-4 ${mapSrc ? "" : "md:grid-cols-2"}`}>
      {(address || comunas.length > 0) && (
        <div className={card} style={cardStyle}>
          {label(MapPin, comunas.length > 0 ? "Dónde atendemos" : "Dirección")}
          {address && <p className="mt-4 text-base">{address}</p>}
          {comunas.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Comunas donde atendemos">
              {comunas.map((c) => (
                <li
                  key={c}
                  className="text-sm rounded-full px-3 py-1.5 font-medium"
                  style={{ background: p.tint, color: p.text }}
                >
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {hours.length > 0 && (
        <div className={card} style={cardStyle}>
          {label(Clock, "Horario de atención")}
          <ul className="mt-4 text-sm divide-y" style={{ borderColor: p.border }}>
            {hours.map((h: OpeningHour) => (
              <li
                key={h.day}
                className="flex justify-between gap-3 py-2"
                style={{ borderColor: withAlpha(p.brand, 0.12) }}
              >
                <span className="font-medium">{WEEKDAYS[h.day] ?? ""}</span>
                <span className="tabular-nums" style={{ color: p.muted }}>
                  {h.closed ? "Cerrado" : `${h.from ?? "—"} – ${h.to ?? "—"}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <section id="ubicacion" data-section="ubicacion" className={WRAP}>
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          eyebrow="Dónde estamos"
          title={comunas.length > 0 ? "Cobertura y horarios" : "Ubicación y horarios"}
          palette={p}
        />
        <div
          className={`grid gap-4 items-start ${mapSrc ? "md:grid-cols-2" : "max-w-4xl mx-auto"}`}
        >
          {info}
          {mapSrc &&
            (preview ? (
              <div
                className="w-full rounded-3xl border grid place-items-center text-sm"
                style={{ borderColor: p.border, aspectRatio: "4 / 3", color: p.muted }}
              >
                Mapa de Google
              </div>
            ) : (
              <iframe
                src={mapSrc}
                title={mapTitle}
                className="w-full rounded-3xl border"
                style={{ borderColor: p.border, aspectRatio: "4 / 3" }}
                loading="lazy"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            ))}
        </div>
      </div>
    </section>
  );
}
