/**
 * Detecta qué tipo de destino es una URL para mostrar el ícono correcto
 * en el multienlace sin que el equipo tenga que elegirlo a mano.
 */
export type LinkKind =
  | "whatsapp"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "youtube"
  | "maps"
  | "reviews"
  | "email"
  | "phone"
  | "website";

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
  maps: "Google Maps",
  reviews: "Reseñas",
  email: "Email",
  phone: "Teléfono",
  website: "Sitio web",
};

export function detectLinkKind(raw: string | null | undefined): LinkKind {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "website";
  if (v.startsWith("mailto:")) return "email";
  if (v.startsWith("tel:")) return "phone";
  // Reseñas antes que Maps: g.page/r/... y writereview también son de Google.
  if (/search\.google\.[a-z.]+\/local\/writereview|g\.page\/r\/|writereview|\/reviews?\b/.test(v))
    return "reviews";
  if (/wa\.me|api\.whatsapp\.com|whatsapp\.com\/send|chat\.whatsapp\.com/.test(v))
    return "whatsapp";
  if (/maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps|maps\.google\.|waze\.com/.test(v))
    return "maps";
  if (/instagram\.com|instagr\.am/.test(v)) return "instagram";
  if (/tiktok\.com/.test(v)) return "tiktok";
  if (/facebook\.com|fb\.me|fb\.com/.test(v)) return "facebook";
  if (/youtube\.com|youtu\.be/.test(v)) return "youtube";
  return "website";
}
