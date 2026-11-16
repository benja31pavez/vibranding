import { useEffect, useMemo, type CSSProperties } from "react";
import { trackEvent } from "@/lib/track";
import { safeImageSrc } from "@/lib/site/safeUrl";
import { jsonLd } from "@/lib/site/landingSeo";
import { meaningfulBio } from "@/components/multilink/bio";
import { PublicItem, SocialIcon } from "@/components/multilink/PublicLinkItem";
import { ShareButton } from "@/components/multilink/ShareButton";
import { itemHref, itemIsLive, type Multilink, type MultilinkItem } from "@/lib/multilink";
import {
  avatarFallbackStyle,
  buttonShapeKey,
  buttonStyleKey,
  fontHref,
  fontKey,
  FONTS,
  parseBackground,
  surfaceTheme,
  withAlpha,
  type SurfaceTheme,
} from "@/lib/multilinkTheme";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const RISE = "motion-safe:animate-[rise-in_0.6s_var(--ease-out-expo)_backwards]";

/** Iniciales para el avatar sin foto ("Proyecta Exteriores" → "PE"). */
function initials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function PublicMultilinkView({
  ml: rawMl,
  items,
  preview = false,
}: {
  ml: Multilink;
  items: MultilinkItem[];
  /** Editor preview: no tracking, no viewport-height shell. */
  preview?: boolean;
}) {
  // Datos del cliente: sólo colores hex e imágenes https llegan al DOM/CSS.
  const ml: Multilink = {
    ...rawMl,
    theme_color: HEX_COLOR.test(rawMl.theme_color ?? "") ? rawMl.theme_color : "#111827",
    avatar_url: safeImageSrc(rawMl.avatar_url),
    bio: meaningfulBio(rawMl.bio),
  };
  useEffect(() => {
    if (preview) return;
    trackEvent("page_view", { type: "multilink", id: ml.id });
  }, [ml.id, preview]);

  const font = fontKey(ml.font_family);
  useEffect(() => {
    // La página pública ya trae la fuente en el <head> (sin salto al hidratar); la
    // vista previa del editor la agrega aquí cuando cambia la tipografía.
    const href = fontHref(font);
    if (document.querySelector(`link[data-ml-font="${font}"], link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.mlFont = font;
    document.head.appendChild(link);
  }, [font]);

  const onClick = (item: MultilinkItem) => {
    if (preview) return;
    trackEvent(item.kind === "whatsapp" ? "whatsapp_click" : "link_click", {
      type: "multilink",
      id: ml.id,
      itemId: item.id,
    });
  };

  // Scheduled items appear and disappear on their own.
  const visible = useMemo(() => items.filter((i) => itemIsLive(i)), [items]);
  const socials = visible.filter((i) => i.kind === "social");
  const rest = visible.filter((i) => i.kind !== "social");

  const bg = parseBackground(ml.background);
  // La portada usa el fondo elegido; el panel (texto y botones) sigue el modo claro/oscuro.
  const theme = surfaceTheme(ml.theme_mode, { type: "flat" });
  const style = buttonStyleKey(ml.button_style);
  const shape = buttonShapeKey(ml.button_shape);
  const accent = ml.theme_color;
  const panelBackground = theme.isDark ? "#0e0e11" : "#fbfaf8";
  const subtleBorder = theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(10,10,10,0.08)";
  const coverImage = bg.type === "image" ? safeImageSrc(bg.url) : null;
  const coverBackground = coverImage
    ? `url("${coverImage}") center / cover`
    : bg.type === "gradient"
      ? `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`
      : bg.type === "solid"
        ? `linear-gradient(135deg, ${bg.color}, ${withAlpha(accent, 0.72)})`
        : `linear-gradient(135deg, ${withAlpha(accent, 0.95)}, ${withAlpha(accent, 0.35)})`;

  // A link-in-bio page is a profile: declare it so search engines can connect
  // the account to its social presence.
  const structuredData = useMemo(() => {
    if (preview || !ml.title) return null;
    const sameAs = socials
      .map((i) => itemHref(i))
      .filter((h): h is string => !!h && h.startsWith("http"));
    return {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      mainEntity: {
        "@type": "Organization",
        name: ml.title,
        ...(ml.bio ? { description: ml.bio } : {}),
        ...(ml.avatar_url ? { image: ml.avatar_url } : {}),
        ...(sameAs.length > 0 ? { sameAs } : {}),
      },
    };
  }, [preview, ml.title, ml.bio, ml.avatar_url, socials]);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background: preview ? panelBackground : theme.isDark ? "#060608" : "#eceef2",
        color: theme.color,
        fontFamily: FONTS[font].family,
      }}
    >
      {!preview && <Backdrop cover={coverBackground} isDark={theme.isDark} />}

      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(structuredData),
          }}
        />
      )}

      <div className={`relative ${preview ? "" : "sm:px-5 sm:py-12"}`}>
        {/* Móvil: panel a pantalla completa (sin marco); desde sm: tarjeta flotante. */}
        <main
          className={`mx-auto overflow-hidden text-center ${preview ? "w-full" : "min-h-screen max-w-[460px] sm:min-h-0 sm:rounded-[2.25rem] sm:border"}`}
          style={{
            background: panelBackground,
            borderColor: subtleBorder,
            boxShadow: preview
              ? undefined
              : `0 40px 90px -40px ${theme.isDark ? "rgba(0,0,0,0.85)" : withAlpha(accent, 0.5)}`,
          }}
        >
          <div
            className="relative h-40 overflow-hidden sm:h-44"
            style={{ background: coverBackground }}
          >
            {coverImage && bg.type === "image" && (
              <div
                className="absolute inset-0"
                style={{ background: `rgba(0,0,0,${bg.overlay})` }}
              />
            )}
            {!preview && (
              <div className="absolute right-3 top-3">
                <ShareButton title={ml.title} />
              </div>
            )}
          </div>

          {/* Hoja que sube sobre la portada: borde limpio en vez de un degradado turbio. */}
          <div
            className="relative -mt-7 rounded-t-[1.75rem] px-5 pb-10 sm:px-8"
            style={{ background: panelBackground }}
          >
            <div className="-mt-14">
              <Avatar ml={ml} panel={panelBackground} accent={accent} theme={theme} />
            </div>
            <h1
              className={`mt-4 text-balance text-2xl font-bold leading-tight tracking-tight sm:text-[1.75rem] ${RISE}`}
              // La tipografía del tema también manda en el título (el global de h1 no).
              style={{ animationDelay: "40ms", fontFamily: "inherit" }}
            >
              {ml.title}
            </h1>
            {ml.bio && (
              <p className="mx-auto mt-2 max-w-[20rem] whitespace-pre-line text-pretty text-[0.925rem] leading-relaxed opacity-75">
                {ml.bio}
              </p>
            )}

            {socials.length > 0 && (
              <nav
                aria-label="Redes sociales"
                className="mt-5 flex flex-wrap items-center justify-center gap-2.5"
              >
                {socials.map((i, k) => (
                  <SocialIcon
                    key={i.id}
                    item={i}
                    theme={theme}
                    accent={accent}
                    index={k}
                    onClick={onClick}
                  />
                ))}
              </nav>
            )}

            <div className="mt-7 space-y-3 text-left">
              {rest.map((i, k) => (
                <PublicItem
                  key={i.id}
                  item={i}
                  color={accent}
                  theme={theme}
                  style={style}
                  shape={shape}
                  index={k + socials.length}
                  onClick={onClick}
                />
              ))}
              {rest.length === 0 && socials.length === 0 && (
                <EmptyLinks preview={preview} border={subtleBorder} />
              )}
            </div>

            <div className="mt-10 flex items-center justify-center gap-2 opacity-50">
              <span className="h-px w-8" style={{ background: theme.color }} />
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em]">
                Multienlace
              </span>
              <span className="h-px w-8" style={{ background: theme.color }} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/** Fondo de la página (desde sm): la portada difuminada más una viñeta suave. */
function Backdrop({ cover, isDark }: { cover: string; isDark: boolean }) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 scale-110 opacity-40 blur-3xl"
        style={{ background: cover }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 80% at 50% 0%, transparent 40%, ${isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.5)"})`,
        }}
        aria-hidden="true"
      />
    </>
  );
}

function Avatar({
  ml,
  panel,
  accent,
  theme,
}: {
  ml: Multilink;
  panel: string;
  accent: string;
  theme: SurfaceTheme;
}) {
  // Anillo con el color de marca: separa la foto de cualquier portada.
  const ring: CSSProperties = {
    background: `conic-gradient(from 210deg, ${accent}, ${withAlpha(accent, 0.25)}, ${accent})`,
  };
  return (
    <div className={`inline-grid rounded-full p-[3px] shadow-xl ${RISE}`} style={ring}>
      <div className="rounded-full p-1" style={{ background: panel }}>
        <div
          className="grid h-24 w-24 place-items-center overflow-hidden rounded-full text-3xl font-bold tracking-tight"
          style={ml.avatar_url ? undefined : avatarFallbackStyle(theme, accent)}
        >
          {ml.avatar_url ? (
            <img
              src={ml.avatar_url}
              width={96}
              height={96}
              fetchPriority="high"
              decoding="async"
              alt={`Logo de ${ml.title}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{initials(ml.title)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Sin enlaces: en la vista previa se muestran huecos de ejemplo para orientar al equipo. */
function EmptyLinks({ preview, border }: { preview: boolean; border: string }) {
  if (!preview) {
    return <p className="py-5 text-center text-sm opacity-60">Sin enlaces todavía.</p>;
  }
  return (
    <div className="space-y-3">
      {[0.9, 0.65, 0.4].map((o) => (
        <div
          key={o}
          aria-hidden="true"
          className="h-14 rounded-2xl border-2 border-dashed"
          style={{ borderColor: border, opacity: o }}
        />
      ))}
      <p className="pt-1 text-center text-xs opacity-60">
        Aquí aparecerán los enlaces que agregues.
      </p>
    </div>
  );
}
