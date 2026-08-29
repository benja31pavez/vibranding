export type MultilinkItemKind = "link" | "whatsapp" | "video";

export type MultilinkItem = {
  id: string;
  multilink_id: string;
  client_id: string;
  title: string;
  url: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  click_count: number;
  kind: MultilinkItemKind;
  featured: boolean;
  subtitle: string | null;
  thumbnail_url: string | null;
  wa_number: string | null;
  wa_message: string | null;
  video_url: string | null;
  start_at: string | null;
  end_at: string | null;
};

export type Multilink = {
  id: string;
  client_id: string;
  slug: string;
  title: string;
  bio: string | null;
  avatar_url: string | null;
  theme_color: string;
  theme_mode: string;
  published: boolean;
  view_count: number;
  custom_domain: string | null;
  custom_domain_verified: boolean;
};

export const KIND_LABEL: Record<MultilinkItemKind, string> = {
  link: "Enlace",
  whatsapp: "WhatsApp",
  video: "Video",
};

/** A scheduled item is only visible inside its window. */
export function itemIsLive(i: MultilinkItem, now: Date = new Date()): boolean {
  if (!i.is_active) return false;
  const t = now.getTime();
  if (i.start_at && new Date(i.start_at).getTime() > t) return false;
  if (i.end_at && new Date(i.end_at).getTime() < t) return false;
  return true;
}

export function scheduleState(
  i: MultilinkItem,
  now: Date = new Date(),
): "live" | "scheduled" | "expired" | "off" {
  if (!i.is_active) return "off";
  const t = now.getTime();
  if (i.start_at && new Date(i.start_at).getTime() > t) return "scheduled";
  if (i.end_at && new Date(i.end_at).getTime() < t) return "expired";
  return "live";
}

export function waHref(i: MultilinkItem): string | null {
  const digits = (i.wa_number ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  const text = (i.wa_message ?? "").trim();
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Destination for a clickable item; null for items rendered inline (video). */
export function itemHref(i: MultilinkItem): string | null {
  if (i.kind === "whatsapp") return waHref(i);
  if (i.kind === "video") return null;
  return i.url && i.url !== "https://" ? i.url : null;
}

/** Turns a YouTube/Vimeo watch URL into an embeddable one. */
export function videoEmbedUrl(raw: string | null): string | null {
  const url = (raw ?? "").trim();
  if (!url) return null;
  const yt =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(url);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return url;
  return null;
}

/** Canonical clean path. The legacy /@slug/links URL keeps working. */
export function multilinkPath(slug: string) {
  return `/l/${slug}`;
}

export function multilinkPublicUrl(ml: Multilink, origin: string) {
  if (ml.custom_domain && ml.custom_domain_verified) {
    return `https://${ml.custom_domain}${multilinkPath(ml.slug)}`;
  }
  return `${origin}${multilinkPath(ml.slug)}`;
}
