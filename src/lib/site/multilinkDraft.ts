/**
 * Borrador del editor de multienlace: los cambios (incluidos enlaces nuevos,
 * borrados y el orden) se acumulan en memoria y se guardan juntos.
 */
import { socialNetwork, videoEmbedUrl, type Multilink, type MultilinkItem } from "@/lib/multilink";
import { detectLinkKind, LINK_KIND_LABEL, type LinkKind } from "@/lib/site/linkKind";
import { safeHref } from "@/lib/site/safeUrl";
import { normalizeChileMobile, normalizeUrl, urlError, whatsappError } from "@/lib/site/validation";

export const TEMP_PREFIX = "tmp-";

export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_PREFIX);
}

function tempId(): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${TEMP_PREFIX}${rnd}`;
}

/** Ícono a mostrar: lo que diga la URL; si no se reconoce, el tipo elegido al crearlo. */
export function itemLinkKind(item: Pick<MultilinkItem, "kind" | "url" | "icon">): LinkKind {
  if (item.kind === "whatsapp") return "whatsapp";
  if (item.kind === "video") return "youtube";
  if (item.kind === "social") {
    const net = socialNetwork(item as MultilinkItem);
    if (net === "email" || net === "phone" || net in LINK_KIND_LABEL) return net as LinkKind;
    return "website";
  }
  const detected = detectLinkKind(item.url);
  if (detected !== "website") return detected;
  return item.icon && item.icon in LINK_KIND_LABEL ? (item.icon as LinkKind) : "website";
}

export type QuickAdd = {
  kind: LinkKind | "video";
  label: string;
  title: string;
  placeholder: string;
  url?: string;
};

export const QUICK_ADDS: QuickAdd[] = [
  {
    kind: "whatsapp",
    label: "WhatsApp",
    title: "Escríbenos por WhatsApp",
    placeholder: "+56 9 1234 5678",
  },
  {
    kind: "instagram",
    label: "Instagram",
    title: "Instagram",
    placeholder: "https://instagram.com/usuario",
  },
  { kind: "tiktok", label: "TikTok", title: "TikTok", placeholder: "https://tiktok.com/@usuario" },
  {
    kind: "website",
    label: "Sitio web",
    title: "Visita nuestra web",
    placeholder: "https://minegocio.cl",
  },
  {
    kind: "maps",
    label: "Google Maps",
    title: "Cómo llegar",
    placeholder: "https://maps.app.goo.gl/…",
  },
  {
    kind: "reviews",
    label: "Reseñas",
    title: "Déjanos tu reseña en Google",
    placeholder: "https://g.page/r/…/review",
  },
  {
    kind: "facebook",
    label: "Facebook",
    title: "Facebook",
    placeholder: "https://facebook.com/pagina",
  },
  {
    kind: "video",
    label: "Video",
    title: "Mira nuestro trabajo",
    placeholder: "https://youtube.com/watch?v=…",
  },
];

export function urlPlaceholder(item: MultilinkItem): string {
  const kind = itemLinkKind(item);
  return QUICK_ADDS.find((q) => q.kind === kind)?.placeholder ?? "https://…";
}

export function newItem(
  ml: Multilink,
  quick: QuickAdd,
  sortOrder: number,
  url = "",
): MultilinkItem {
  const base: MultilinkItem = {
    id: tempId(),
    multilink_id: ml.id,
    client_id: ml.client_id,
    title: quick.title,
    url: "",
    icon: null,
    sort_order: sortOrder,
    is_active: true,
    click_count: 0,
    kind: "link",
    featured: false,
    subtitle: null,
    thumbnail_url: null,
    wa_number: null,
    wa_message: null,
    video_url: null,
    start_at: null,
    end_at: null,
  };
  if (quick.kind === "whatsapp") {
    return {
      ...base,
      kind: "whatsapp",
      icon: "whatsapp",
      wa_message: "Hola, vengo desde su Instagram y quiero más información.",
    };
  }
  if (quick.kind === "video") return { ...base, kind: "video", video_url: url || null };
  return { ...base, icon: quick.kind, url };
}

/* ---------------- validación ---------------- */

export type ItemErrors = Record<string, string>;

export function validateItems(items: MultilinkItem[]): ItemErrors {
  const e: ItemErrors = {};
  for (const i of items) {
    if (!i.title.trim()) e[`${i.id}.title`] = "Escribe el texto del botón";
    if (i.kind === "whatsapp") {
      const err = whatsappError(i.wa_number);
      if (err) e[`${i.id}.wa_number`] = err;
    } else if (i.kind === "video") {
      const raw = normalizeUrl(i.video_url ?? i.url);
      if (!raw) e[`${i.id}.video_url`] = "Pega el enlace del video";
      else if (urlError(raw) || !videoEmbedUrl(raw))
        e[`${i.id}.video_url`] = "Usa un enlace de YouTube, Vimeo o .mp4";
    } else if (i.kind === "link") {
      const raw = normalizeUrl(i.url);
      if (!raw) e[`${i.id}.url`] = "Pega la URL de destino";
      else {
        const err = /^(mailto:|tel:)/i.test(raw)
          ? safeHref(raw)
            ? null
            : "Email o teléfono inválido"
          : urlError(raw);
        if (err) e[`${i.id}.url`] = err;
      }
    }
  }
  return e;
}

export function validateProfile(ml: Multilink): ItemErrors {
  const e: ItemErrors = {};
  if (!ml.title.trim()) e.title = "Escribe el nombre que se muestra";
  if (!ml.slug.trim()) e.slug = "Escribe la dirección";
  return e;
}

/* ---------------- guardado ---------------- */

export function itemPayload(i: MultilinkItem, sortOrder: number) {
  const isLink = i.kind === "link";
  return {
    title: i.title.trim(),
    url: isLink ? normalizeUrl(i.url) : i.url,
    icon: isLink ? itemLinkKind(i) : i.icon,
    is_active: i.is_active,
    kind: i.kind,
    featured: i.featured,
    subtitle: i.subtitle?.trim() || null,
    thumbnail_url: i.thumbnail_url,
    wa_number:
      i.kind === "whatsapp" ? (normalizeChileMobile(i.wa_number) ?? i.wa_number) : i.wa_number,
    wa_message: i.wa_message,
    video_url: i.kind === "video" ? normalizeUrl(i.video_url) || null : i.video_url,
    start_at: i.start_at,
    end_at: i.end_at,
    sort_order: sortOrder,
  };
}

/** Qué insertar, actualizar y borrar para pasar de `saved` a `draft`. */
export function diffItems(saved: MultilinkItem[], draft: MultilinkItem[]) {
  const savedById = new Map(saved.map((i) => [i.id, i]));
  const draftIds = new Set(draft.map((i) => i.id));
  const inserts: { tempId: string; row: ReturnType<typeof itemPayload> }[] = [];
  const updates: { id: string; row: ReturnType<typeof itemPayload> }[] = [];
  draft.forEach((item, idx) => {
    const row = itemPayload(item, idx);
    if (isTempId(item.id)) {
      inserts.push({ tempId: item.id, row });
      return;
    }
    const before = savedById.get(item.id);
    if (!before || JSON.stringify(itemPayload(before, before.sort_order)) !== JSON.stringify(row)) {
      updates.push({ id: item.id, row });
    }
  });
  const deletes = saved.filter((i) => !draftIds.has(i.id)).map((i) => i.id);
  return { inserts, updates, deletes };
}
