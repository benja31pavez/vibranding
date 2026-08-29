import { useEffect, useMemo } from "react";
import { trackEvent } from "@/lib/track";
import {
  itemHref,
  itemIsLive,
  videoEmbedUrl,
  type Multilink,
  type MultilinkItem,
} from "@/lib/multilink";
import { MessageCircle, Play } from "lucide-react";

export function PublicMultilinkView({
  ml,
  items,
}: {
  ml: Multilink;
  items: MultilinkItem[];
}) {
  useEffect(() => {
    trackEvent("page_view", { type: "multilink", id: ml.id });
  }, [ml.id]);

  const onClick = (item: MultilinkItem) => {
    trackEvent(item.kind === "whatsapp" ? "whatsapp_click" : "link_click", {
      type: "multilink",
      id: ml.id,
      itemId: item.id,
    });
  };

  // Scheduled items appear and disappear on their own.
  const visible = useMemo(() => items.filter((i) => itemIsLive(i)), [items]);
  const isDark = ml.theme_mode === "dark";

  return (
    <div
      className="min-h-screen px-4 py-12"
      style={{
        background: isDark ? "#0a0a0a" : "#fafafa",
        color: isDark ? "#fafafa" : "#0a0a0a",
      }}
    >
      <div className="max-w-md mx-auto text-center">
        <div className="w-24 h-24 rounded-full mx-auto bg-black/10 overflow-hidden grid place-items-center text-3xl font-semibold">
          {ml.avatar_url ? (
            <img src={ml.avatar_url} alt={ml.title} className="w-full h-full object-cover" />
          ) : (
            ml.title[0] || "?"
          )}
        </div>
        <h1 className="mt-4 text-2xl font-semibold">{ml.title}</h1>
        {ml.bio && <p className="mt-2 opacity-80 whitespace-pre-line">{ml.bio}</p>}

        <div className="mt-8 space-y-3 text-left">
          {visible.map((i) => (
            <PublicItem key={i.id} item={i} color={ml.theme_color} onClick={onClick} />
          ))}
          {visible.length === 0 && (
            <p className="opacity-60 text-sm text-center">Sin enlaces todavía.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PublicItem({
  item,
  color,
  onClick,
}: {
  item: MultilinkItem;
  color: string;
  onClick: (i: MultilinkItem) => void;
}) {
  if (item.kind === "video") {
    const embed = videoEmbedUrl(item.video_url ?? item.url);
    return (
      <div className="rounded-2xl overflow-hidden border border-black/10 bg-black/5">
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
  const bg = isWa ? "#25D366" : color;

  if (item.featured) {
    return (
      <a
        href={href ?? "#"}
        target="_blank"
        rel="noreferrer noopener"
        onClick={() => onClick(item)}
        className="block rounded-2xl overflow-hidden shadow-lg transition hover:scale-[1.01]"
        style={{ background: bg, color: "#fff" }}
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

  return (
    <a
      href={href ?? "#"}
      target="_blank"
      rel="noreferrer noopener"
      onClick={() => onClick(item)}
      className="flex items-center gap-3 rounded-xl py-4 px-5 font-medium transition hover:scale-[1.02]"
      style={{ background: bg, color: "#fff" }}
    >
      {item.thumbnail_url ? (
        <img src={item.thumbnail_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
      ) : isWa ? (
        <MessageCircle className="w-5 h-5" />
      ) : null}
      <span className="flex-1 text-center">
        {item.title}
        {item.subtitle && <span className="block text-xs opacity-90">{item.subtitle}</span>}
      </span>
    </a>
  );
}
