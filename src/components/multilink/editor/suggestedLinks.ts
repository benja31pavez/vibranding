import type { ClientSiteData } from "@/components/site/useClientSiteData";
import type { Multilink, MultilinkItem } from "@/lib/multilink";
import { LINK_KIND_LABEL, type LinkKind } from "@/lib/site/linkKind";
import { itemLinkKind, newItem, QUICK_ADDS, type QuickAdd } from "@/lib/site/multilinkDraft";
import { formatChileMobile } from "@/lib/site/validation";

/** Un enlace listo para agregar en un clic, armado solo con datos que el cliente ya entregó. */
export type LinkSuggestion = {
  key: string;
  kind: LinkKind;
  label: string;
  title: string;
  url: string;
  /** Solo WhatsApp: número ya validado (+569…). */
  wa?: string;
};

const quick = (kind: LinkKind): QuickAdd =>
  QUICK_ADDS.find((q) => q.kind === kind) ?? {
    kind,
    label: LINK_KIND_LABEL[kind],
    title: LINK_KIND_LABEL[kind],
    placeholder: "",
  };

const SOCIAL_SUGGESTIONS: { key: keyof ClientSiteData["socials"]; kind: LinkKind }[] = [
  { key: "instagram", kind: "instagram" },
  { key: "tiktok", kind: "tiktok" },
  { key: "facebook", kind: "facebook" },
  { key: "youtube", kind: "youtube" },
  { key: "web", kind: "website" },
];

const sameUrl = (a: string, b: string) =>
  a.trim().replace(/\/+$/, "").toLowerCase() === b.trim().replace(/\/+$/, "").toLowerCase();

/** Sugerencias que aún no están en la lista (por tipo o por URL). */
export function linkSuggestions(
  data: ClientSiteData,
  landingUrl: string | null,
  items: MultilinkItem[],
): LinkSuggestion[] {
  const has = (kind: LinkKind, url?: string) =>
    items.some((i) =>
      kind === "whatsapp"
        ? i.kind === "whatsapp"
        : (url && sameUrl(i.url ?? "", url)) || (kind !== "website" && itemLinkKind(i) === kind),
    );
  const out: LinkSuggestion[] = [];
  if (data.whatsapp && !has("whatsapp")) {
    out.push({
      key: "whatsapp",
      kind: "whatsapp",
      label: `WhatsApp ${formatChileMobile(data.whatsapp)}`,
      title: quick("whatsapp").title,
      url: "",
      wa: data.whatsapp,
    });
  }
  if (landingUrl && !has("website", landingUrl)) {
    out.push({
      key: "landing",
      kind: "website",
      label: "Landing page",
      title: "Conoce nuestros servicios",
      url: landingUrl,
    });
  }
  for (const s of SOCIAL_SUGGESTIONS) {
    const url = data.socials[s.key];
    if (!url || has(s.kind, url)) continue;
    const q = quick(s.kind);
    out.push({ key: s.key, kind: s.kind, label: q.label, title: q.title, url });
  }
  const maps = data.landing?.mapsUrl;
  if (maps && !has("maps", maps)) {
    out.push({ key: "maps", kind: "maps", label: "Google Maps", title: "Cómo llegar", url: maps });
  }
  return out;
}

export function suggestionToItem(
  ml: Multilink,
  s: LinkSuggestion,
  sortOrder: number,
): MultilinkItem {
  const item = newItem(ml, { ...quick(s.kind), title: s.title }, sortOrder, s.url);
  return s.wa ? { ...item, wa_number: formatChileMobile(s.wa) } : item;
}
