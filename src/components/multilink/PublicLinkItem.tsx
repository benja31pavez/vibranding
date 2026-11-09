import type { CSSProperties } from "react";
import { ArrowUpRight, Instagram, Linkedin, Mail, Phone, Play } from "lucide-react";
import { bestOn } from "@/lib/landingTheme";
import { safeImageSrc } from "@/lib/site/safeUrl";
import { itemLinkKind } from "@/lib/site/multilinkDraft";
import { LinkIcon } from "@/components/multilink/LinkIcon";
import { BrandIcon, type BrandGlyph } from "@/components/multilink/BrandIcon";
import {
  itemHref,
  socialNetwork,
  videoEmbedUrl,
  SOCIAL_LABEL,
  type MultilinkItem,
  type SocialNetwork,
} from "@/lib/multilink";
import {
  buttonShapeKey,
  buttonStyleKey,
  itemVisual,
  SHAPE_RADIUS,
  withAlpha,
  type SurfaceTheme,
} from "@/lib/multilinkTheme";

type OnItemClick = (i: MultilinkItem) => void;

/** Entrada escalonada (solo si el sistema no pide menos movimiento). */
const RISE = "motion-safe:animate-[rise-in_0.6s_var(--ease-out-expo)_backwards]";
const MAX_STAGGER_MS = 420;

export function riseStyle(index: number): CSSProperties {
  return { animationDelay: `${Math.min(80 + index * 55, MAX_STAGGER_MS)}ms` };
}

/** Fondo tenue del color del texto actual (sirve igual sobre botón sólido o transparente). */
const TINT = "color-mix(in srgb, currentColor 13%, transparent)";

const LUCIDE_SOCIAL: Partial<Record<SocialNetwork, typeof Instagram>> = {
  instagram: Instagram,
  linkedin: Linkedin,
  email: Mail,
  phone: Phone,
};

function SocialGlyph({ net, className }: { net: SocialNetwork; className: string }) {
  const Lucide = LUCIDE_SOCIAL[net];
  if (Lucide) return <Lucide className={className} aria-hidden="true" />;
  return <BrandIcon brand={net as BrandGlyph} className={className} />;
}

export function SocialIcon({
  item,
  theme,
  accent,
  index,
  onClick,
}: {
  item: MultilinkItem;
  theme: SurfaceTheme;
  accent: string;
  index: number;
  onClick: OnItemClick;
}) {
  const net = socialNetwork(item);
  const href = itemHref(item);
  // Nothing to link to: rendering "#" in a new tab just opened a blank copy.
  if (!href) return null;
  const external = href.startsWith("http");
  const label = item.title || SOCIAL_LABEL[net];
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      aria-label={label}
      title={label}
      onClick={() => onClick(item)}
      className={`grid h-11 w-11 place-items-center rounded-full transition duration-300 hover:bg-[var(--ml-accent)] hover:text-[var(--ml-on)] focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:hover:-translate-y-0.5 active:scale-95 ${RISE}`}
      style={
        {
          ...riseStyle(index),
          "--ml-accent": accent,
          "--ml-on": bestOn(accent),
          background: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.05)",
          border: `1px solid ${theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.08)"}`,
          color: theme.color,
          outlineColor: accent,
        } as CSSProperties
      }
    >
      <SocialGlyph net={net} className="h-[18px] w-[18px]" />
    </a>
  );
}

export function PublicItem({
  item,
  color,
  theme,
  style,
  shape,
  index,
  onClick,
}: {
  item: MultilinkItem;
  color: string;
  theme: SurfaceTheme;
  style: ReturnType<typeof buttonStyleKey>;
  shape: ReturnType<typeof buttonShapeKey>;
  index: number;
  onClick: OnItemClick;
}) {
  if (item.kind === "video") {
    return <VideoItem item={item} color={color} theme={theme} shape={shape} index={index} />;
  }

  const href = itemHref(item);
  const thumb = safeImageSrc(item.thumbnail_url);
  const isWa = item.kind === "whatsapp";
  const accent = isWa ? "#25D366" : color;
  // Only http(s) destinations belong in a new tab — mailto:/tel: used to leave an
  // orphan blank tab. Without an href we render plain content instead of a dead link.
  const external = !!href && href.startsWith("http");
  const linkProps = {
    href: href ?? undefined,
    target: external ? "_blank" : undefined,
    rel: external ? "noreferrer noopener" : undefined,
    onClick: href ? () => onClick(item) : undefined,
  };
  const radius = SHAPE_RADIUS[shape];
  const innerRadius = shape === "pill" ? "999px" : shape === "square" ? "0.1rem" : "0.6rem";

  if (item.featured) {
    return (
      <a
        {...linkProps}
        className={`group relative isolate block overflow-hidden btn-shine shadow-lg transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 motion-safe:hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99] ${RISE}`}
        style={{
          ...riseStyle(index),
          background: accent,
          color: bestOn(accent),
          borderRadius: shape === "pill" && thumb ? "1.75rem" : radius,
          outlineColor: accent,
          boxShadow: `0 14px 32px -14px ${withAlpha(accent, 0.75)}`,
        }}
      >
        {thumb && (
          <img
            src={thumb}
            alt=""
            width={440}
            height={160}
            loading="lazy"
            decoding="async"
            className="h-40 w-full object-cover"
          />
        )}
        <div className="flex min-h-[4.25rem] items-center gap-3 py-3 pl-3 pr-4 text-left">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center"
            style={{ background: TINT, borderRadius: innerRadius }}
          >
            <LinkIcon kind={itemLinkKind(item)} className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold leading-snug tracking-tight">
              {item.title}
            </span>
            {item.subtitle && (
              <span className="mt-0.5 block text-xs leading-snug opacity-90">{item.subtitle}</span>
            )}
          </span>
          <ArrowUpRight
            className="h-5 w-5 shrink-0 opacity-80 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
      </a>
    );
  }

  const visual = itemVisual(style, shape, accent, theme);

  // Editorial row: leading media/icon tile, left-aligned label, trailing arrow.
  return (
    <a
      {...linkProps}
      className={`group relative flex min-h-[3.75rem] items-center gap-3 py-2.5 pl-2.5 pr-4 text-left focus-visible:outline-2 focus-visible:outline-offset-4 ${visual.className} ${RISE}`}
      style={{ ...riseStyle(index), ...visual.style, outlineColor: theme.color }}
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className="h-10 w-10 shrink-0 object-cover"
          style={{ borderRadius: innerRadius }}
        />
      ) : (
        <span
          className="grid h-10 w-10 shrink-0 place-items-center"
          style={{ background: TINT, borderRadius: innerRadius }}
        >
          <LinkIcon kind={itemLinkKind(item)} className="h-[18px] w-[18px]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] font-semibold leading-snug tracking-tight">
          {item.title}
        </span>
        {item.subtitle && (
          <span className="mt-0.5 block text-xs leading-snug opacity-75">{item.subtitle}</span>
        )}
      </span>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 opacity-50 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-90"
        aria-hidden="true"
      />
    </a>
  );
}

function VideoItem({
  item,
  color,
  theme,
  shape,
  index,
}: {
  item: MultilinkItem;
  color: string;
  theme: SurfaceTheme;
  shape: ReturnType<typeof buttonShapeKey>;
  index: number;
}) {
  const embed = videoEmbedUrl(item.video_url ?? item.url);
  return (
    <div
      className={`overflow-hidden shadow-sm ${RISE}`}
      style={{
        ...riseStyle(index),
        borderRadius: shape === "pill" ? "1.5rem" : SHAPE_RADIUS[shape],
        border: `1px solid ${withAlpha(color, 0.3)}`,
        background: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.04)",
      }}
    >
      {embed ? (
        <div className="aspect-video bg-black">
          {/\.(mp4|webm|mov)(\?|$)/i.test(embed) ? (
            <video src={embed} controls preload="metadata" className="h-full w-full object-cover" />
          ) : (
            <iframe
              src={embed}
              title={item.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          )}
        </div>
      ) : (
        <div className="grid aspect-video place-items-center text-sm opacity-60">
          <Play className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <div className="px-4 py-3 text-left">
        <div className="font-semibold tracking-tight">{item.title}</div>
        {item.subtitle && <div className="text-sm opacity-70">{item.subtitle}</div>}
      </div>
    </div>
  );
}
