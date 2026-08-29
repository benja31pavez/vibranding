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
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Music2,
  Phone,
  Play,
  Twitter,
  Youtube,
} from "lucide-react";

const SOCIAL_ICON: Record<SocialNetwork, typeof Instagram> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  spotify: Music2,
  facebook: Facebook,
  x: Twitter,
  linkedin: Linkedin,
  email: Mail,
  phone: Phone,
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

  return (
    <div
      className={`relative ${preview ? "min-h-full" : "min-h-screen"}`}
      style={{
        background: theme.background,
        color: theme.color,
        fontFamily: FONTS[font].family,
        ...(theme.imageUrl
          ? {
              backgroundImage: `url(${theme.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : null),
      }}
    >
      {theme.overlay && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: theme.overlay }} />
      )}

      <div className={`relative px-4 ${preview ? "py-8" : "py-12"}`}>
        <div className="max-w-md mx-auto text-center">
          <div
            className="w-24 h-24 rounded-full mx-auto overflow-hidden grid place-items-center text-3xl font-semibold"
            style={ml.avatar_url ? undefined : avatarFallbackStyle(theme, ml.theme_color)}
          >
            {ml.avatar_url ? (
              <img src={ml.avatar_url} alt={ml.title} className="w-full h-full object-cover" />
            ) : (
              ml.title[0] || "?"
            )}
          </div>
          <h1 className="mt-4 text-2xl font-semibold">{ml.title}</h1>
          {ml.bio && <p className="mt-2 opacity-80 whitespace-pre-line">{ml.bio}</p>}

          {socials.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {socials.map((i) => (
                <SocialIcon key={i.id} item={i} theme={theme} accent={ml.theme_color} onClick={onClick} />
              ))}
            </div>
          )}

          <div className="mt-8 space-y-3 text-left">
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
              <p className="opacity-60 text-sm text-center">Sin enlaces todavía.</p>
            )}
          </div>
        </div>
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
  return (
    <a
      href={href ?? "#"}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer noopener"
      aria-label={item.title || SOCIAL_LABEL[net]}
      title={item.title || SOCIAL_LABEL[net]}
      onClick={() => onClick(item)}
      className="grid place-items-center w-11 h-11 rounded-full transition hover:scale-110"
      style={{
        background: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.06)",
        border: `1px solid ${withAlpha(accent, 0.4)}`,
        color: theme.color,
      }}
    >
      <Icon className="w-5 h-5" />
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
              <video src={embed} controls className="w-full h-full object-cover" />
            ) : (
              <iframe
                src={embed}
                title={item.title}
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

  if (item.featured) {
    return (
      <a
        href={href ?? "#"}
        target="_blank"
        rel="noreferrer noopener"
        onClick={() => onClick(item)}
        className="block overflow-hidden shadow-lg transition hover:scale-[1.01]"
        style={{ background: accent, color: "#fff", borderRadius: SHAPE_RADIUS[shape] }}
      >
        {item.thumbnail_url && (
          <img src={item.thumbnail_url} alt="" className="w-full h-40 object-cover" />
        )}
        <div className="px-5 py-5">
          <div className="text-lg font-semibold flex items-center gap-2">
            {isWa && <MessageCircle className="w-5 h-5" />}
            {item.title}
          </div>
          {item.subtitle && <div className="text-sm opacity-90 mt-1">{item.subtitle}</div>}
        </div>
      </a>
    );
  }

  const visual = itemVisual(style, shape, accent, theme);

  // The label is centred against the full button width; the leading icon or
  // thumbnail is absolutely positioned so it never pushes the text sideways.
  return (
    <a
      href={href ?? "#"}
      target="_blank"
      rel="noreferrer noopener"
      onClick={() => onClick(item)}
      className={`relative flex items-center justify-center py-4 px-14 font-medium text-center ${visual.className}`}
      style={visual.style}
    >
      {item.thumbnail_url ? (
        <img
          src={item.thumbnail_url}
          alt=""
          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg object-cover"
        />
      ) : isWa ? (
        <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" />
      ) : null}
      <span className="min-w-0">
        {item.title}
        {item.subtitle && <span className="block text-xs opacity-80">{item.subtitle}</span>}
      </span>
    </a>
  );
}
