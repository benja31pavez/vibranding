import { useEffect, useMemo } from "react";
import { trackEvent } from "@/lib/track";
import {
  itemHref,
  itemIsLive,
  socialNetwork,
  videoEmbedUrl,
  SOCIAL_LABEL,
  type Multilink,
  type MultilinkItem,
  type SocialNetwork,
} from "@/lib/multilink";
import {
  avatarFallbackStyle,
  buttonShapeKey,
  buttonStyleKey,
  fontHref,
  fontKey,
  FONTS,
  itemVisual,
  parseBackground,
  SHAPE_RADIUS,
  surfaceTheme,
  withAlpha,
  type SurfaceTheme,
} from "@/lib/multilinkTheme";
import {
  Facebook,
  ArrowUpRight,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Phone,
  Play,
  Twitter,
  Youtube,
} from "lucide-react";
import {
  AmazonMusicIcon,
  AppleMusicIcon,
  DeezerIcon,
  SpotifyIcon,
  TidalIcon,
} from "@/components/icons/PlatformIcons";

type IconComponent = React.ComponentType<{ className?: string }>;

const SOCIAL_ICON: Record<SocialNetwork, IconComponent> = {
  instagram: Instagram,
  tiktok: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  ),
  youtube: Youtube,
  spotify: SpotifyIcon,
  facebook: Facebook,
  x: Twitter,
  linkedin: Linkedin,
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
  apple_music: AppleMusicIcon,
  deezer: DeezerIcon,
  tidal: TidalIcon,
  amazon_music: AmazonMusicIcon,
};

export function PublicMultilinkView({
  ml,
  items,
  preview = false,
}: {
  ml: Multilink;
  items: MultilinkItem[];
  /** Editor preview: no tracking, no viewport-height shell. */
  preview?: boolean;
}) {
  useEffect(() => {
    if (preview) return;
    trackEvent("page_view", { type: "multilink", id: ml.id });
  }, [ml.id, preview]);

  const font = fontKey(ml.font_family);
  useEffect(() => {
    const href = fontHref(font);
    if (document.querySelector(`link[data-ml-font="${font}"]`)) return;
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
  const theme = surfaceTheme(ml.theme_mode, bg);
  const style = buttonStyleKey(ml.button_style);
  const shape = buttonShapeKey(ml.button_shape);
  const panelBackground = theme.isDark ? "rgba(13,13,15,0.96)" : "rgba(250,248,245,0.98)";
  const subtleBorder = theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(10,10,10,0.09)";
  const coverBackground =
    bg.type === "image" && bg.url
      ? `url(${bg.url}) center / cover`
      : bg.type === "gradient"
        ? `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`
        : bg.type === "solid"
          ? `linear-gradient(135deg, ${bg.color}, ${withAlpha(ml.theme_color, 0.72)})`
          : `linear-gradient(135deg, ${withAlpha(ml.theme_color, 0.92)}, ${withAlpha(ml.theme_color, 0.3)})`;

  // A link-in-bio page is a profile: declare it so search engines can connect
  // the account to its social presence.
  const structuredData = useMemo(() => {
    if (preview || !ml.title) return null;
    const sameAs = socials.map((i) => itemHref(i)).filter((h): h is string => !!h && h.startsWith("http"));
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
      className={`relative overflow-hidden ${preview ? "min-h-full" : "min-h-screen"}`}
      style={{ background: theme.isDark ? "#070709" : "#eef0f4", color: theme.color, fontFamily: FONTS[font].family }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-35 blur-3xl scale-110"
        style={{ background: coverBackground }}
      />

      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      )}

      <div className={`relative px-3 sm:px-5 ${preview ? "py-4" : "py-5 sm:py-10"}`}>
        <main
          className="max-w-[440px] mx-auto overflow-hidden text-center shadow-2xl sm:rounded-[2rem]"
          style={{ background: panelBackground, border: `1px solid ${subtleBorder}` }}
        >
          <div className="relative h-40 sm:h-44 overflow-hidden" style={{ background: coverBackground }}>
            {bg.type === "image" && <div className="absolute inset-0" style={{ background: theme.overlay ?? "transparent" }} />}
            <div
              className="absolute inset-x-0 bottom-0 h-24"
              style={{ background: `linear-gradient(to top, ${panelBackground}, transparent)` }}
            />
          </div>

          <div className="relative -mt-14 px-5 sm:px-7 pb-9">
            <div className="inline-grid rounded-full p-1.5 shadow-xl" style={{ background: panelBackground }}>
              <div
                className="w-24 h-24 rounded-full overflow-hidden grid place-items-center text-3xl font-semibold"
                style={ml.avatar_url ? { border: `2px solid ${subtleBorder}` } : avatarFallbackStyle(theme, ml.theme_color)}
              >
                {ml.avatar_url ? (
                  <img src={ml.avatar_url} alt={`Foto de ${ml.title}`} className="w-full h-full object-cover" />
                ) : (
                  ml.title[0] || "?"
                )}
              </div>
            </div>
            <h1 className="mt-4 text-[1.35rem] sm:text-[1.7rem] leading-tight font-bold tracking-tight">{ml.title}</h1>
            {ml.bio && <p className="mt-2 mx-auto max-w-xs text-sm leading-relaxed opacity-70 whitespace-pre-line">{ml.bio}</p>}

            {socials.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                {socials.map((i) => (
                  <SocialIcon key={i.id} item={i} theme={theme} accent={ml.theme_color} onClick={onClick} />
                ))}
              </div>
            )}

            <div className="mt-7 space-y-3 text-left">
              {rest.map((i) => (
                <PublicItem
                  key={i.id}
                  item={i}
                  color={ml.theme_color}
                  theme={theme}
                  style={style}
                  shape={shape}
                  onClick={onClick}
                />
              ))}
              {rest.length === 0 && socials.length === 0 && (
                <p className="opacity-60 text-sm text-center py-5">Sin enlaces todavía.</p>
              )}
            </div>

            <div className="mt-9 flex items-center justify-center gap-2 opacity-35">
              <span className="h-px w-6" style={{ background: theme.color }} />
              <span className="text-[9px] font-semibold uppercase">Multienlace</span>
              <span className="h-px w-6" style={{ background: theme.color }} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SocialIcon({
  item,
  theme,
  accent,
  onClick,
}: {
  item: MultilinkItem;
  theme: SurfaceTheme;
  accent: string;
  onClick: (i: MultilinkItem) => void;
}) {
  const net = socialNetwork(item);
  const Icon = SOCIAL_ICON[net];
  const href = itemHref(item);
  // Nothing to link to: rendering "#" in a new tab just opened a blank copy.
  if (!href) return null;
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      aria-label={item.title || SOCIAL_LABEL[net]}
      title={item.title || SOCIAL_LABEL[net]}
      onClick={() => onClick(item)}
      className="grid place-items-center w-10 h-10 rounded-full transition duration-300 hover:-translate-y-0.5 hover:scale-105"
      style={{
        background: theme.isDark ? "rgba(255,255,255,0.07)" : "rgba(10,10,10,0.045)",
        border: `1px solid ${withAlpha(accent, 0.32)}`,
        color: theme.color,
      }}
    >
      <Icon className="w-[18px] h-[18px]" />
    </a>
  );
}

function PublicItem({
  item,
  color,
  theme,
  style,
  shape,
  onClick,
}: {
  item: MultilinkItem;
  color: string;
  theme: SurfaceTheme;
  style: ReturnType<typeof buttonStyleKey>;
  shape: ReturnType<typeof buttonShapeKey>;
  onClick: (i: MultilinkItem) => void;
}) {
  if (item.kind === "video") {
    const embed = videoEmbedUrl(item.video_url ?? item.url);
    return (
      <div
        className="overflow-hidden"
        style={{
          borderRadius: SHAPE_RADIUS[shape],
          border: `1px solid ${withAlpha(color, 0.3)}`,
          background: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.05)",
        }}
      >
        {embed ? (
          <div className="aspect-video">
            {/\.(mp4|webm|mov)(\?|$)/i.test(embed) ? (
              <video src={embed} controls preload="metadata" className="w-full h-full object-cover" />
            ) : (
              <iframe
                src={embed}
                title={item.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            )}
          </div>
        ) : (
          <div className="aspect-video grid place-items-center opacity-60 text-sm">
            <Play className="w-6 h-6" />
          </div>
        )}
        <div className="px-4 py-3">
          <div className="font-medium">{item.title}</div>
          {item.subtitle && <div className="text-sm opacity-70">{item.subtitle}</div>}
        </div>
      </div>
    );
  }

  const href = itemHref(item);
  const isWa = item.kind === "whatsapp";
  const accent = isWa ? "#25D366" : color;
  // Only http(s) destinations belong in a new tab — mailto:/tel: used to leave an
  // orphan blank tab. Without an href we render plain content instead of a dead link.
  const external = !!href && href.startsWith("http");

  if (item.featured) {
    return (
      <a
        href={href ?? undefined}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
        onClick={href ? () => onClick(item) : undefined}
        className="group block overflow-hidden shadow-xl transition duration-300 hover:-translate-y-0.5"
        style={{ background: accent, color: "#fff", borderRadius: SHAPE_RADIUS[shape] }}
      >
        {item.thumbnail_url && (
          <img src={item.thumbnail_url} alt="" loading="lazy" decoding="async" className="w-full h-40 object-cover" />
        )}
        <div className="px-4 py-3.5 relative text-left">
          <div className="text-[0.95rem] font-semibold tracking-tight flex items-center gap-2 pr-8">
            {isWa && <MessageCircle className="w-[18px] h-[18px] shrink-0" />}
            {item.title}
          </div>
          {item.subtitle && <div className="text-[0.72rem] opacity-90 mt-0.5">{item.subtitle}</div>}
          <ArrowUpRight className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-65 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-[60%]" />
        </div>
      </a>
    );
  }

  const visual = itemVisual(style, shape, accent, theme);
  const hasLead = !!item.thumbnail_url || isWa;

  // Editorial row: leading media/icon, left-aligned label, trailing arrow.
  return (
    <a
      href={href ?? undefined}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      onClick={href ? () => onClick(item) : undefined}
      className={`group relative flex min-h-14 items-center gap-3 py-3 pr-10 ${hasLead ? "pl-3" : "pl-4"} text-left shadow-sm ${visual.className}`}
      style={visual.style}
    >
      {item.thumbnail_url ? (
        <img
          src={item.thumbnail_url}
          alt=""
          loading="lazy"
          decoding="async"
          className="shrink-0 w-9 h-9 rounded-lg object-cover"
        />
      ) : isWa ? (
        <MessageCircle className="shrink-0 w-5 h-5" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] font-semibold leading-snug tracking-tight">{item.title}</span>
        {item.subtitle && <span className="block text-[0.7rem] leading-snug opacity-75">{item.subtitle}</span>}
      </span>
      <ArrowUpRight className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-45 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-[60%]" />
    </a>
  );
}
