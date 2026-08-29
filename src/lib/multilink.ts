export type MultilinkItemKind = "link" | "whatsapp" | "video" | "social";

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
  button_style: string;
  button_shape: string;
  font_family: string;
  background: unknown;
};

export const KIND_LABEL: Record<MultilinkItemKind, string> = {
  link: "Enlace",
  whatsapp: "WhatsApp",
  video: "Video",
  social: "Red social",
};

export type SocialNetwork =
  | "instagram" | "tiktok" | "youtube" | "spotify"
  | "facebook" | "x" | "linkedin" | "email" | "phone";

export const SOCIAL_LABEL: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  spotify: "Spotify",
  facebook: "Facebook",
  x: "X",
  linkedin: "LinkedIn",
  email: "Email",
  phone: "Teléfono",
};

export function socialNetwork(i: MultilinkItem): SocialNetwork {
  const key = (i.icon ?? "").toLowerCase();
  return key in SOCIAL_LABEL ? (key as SocialNetwork) : "instagram";
}

/** Social items accept a bare handle, email or phone as well as a full URL. */
export function socialHref(i: MultilinkItem): string | null {
  const net = socialNetwork(i);
  const raw = (i.url ?? "").trim();
  if (!raw || raw === "https://") return null;
  if (net === "email") return raw.startsWith("mailto:") ? raw : `mailto:${raw}`;
  if (net === "phone") {
    const digits = raw.replace(/[^\d+]/g, "");
    return digits ? `tel:${digits}` : null;
  }
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "");
  const bases: Record<SocialNetwork, string> = {
    instagram: "https://instagram.com/",
    tiktok: "https://tiktok.com/@",
    youtube: "https://youtube.com/@",
    spotify: "https://open.spotify.com/",
    facebook: "https://facebook.com/",
    x: "https://x.com/",
    linkedin: "https://linkedin.com/in/",
    email: "mailto:",
    phone: "tel:",
  };
  return `${bases[net]}${handle}`;
}


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
